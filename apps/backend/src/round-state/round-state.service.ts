import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import {
  ArchivedRoundWorker,
  LiveWorkerState,
  RawShareMessage,
} from "@shares-viewer/types";

type RoundWorkerRedisState = {
  workerName: string;
  address: string;
  displayName: string;
  bestShare: string;
  sharesCount: string;
  lastShareTs: string;
  level: string;
};

@Injectable()
export class RoundStateService {
  private readonly logger = new Logger(RoundStateService.name);
  private static readonly WORKER_SEPARATOR = "::";

  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.client;
  }

  private currentRoundKey() {
    return "sv:current_round";
  }

  private roundStartedAtKey(round: string) {
    return `sv:round:${round}:started_at`;
  }

  private roundWorkersSetKey(round: string) {
    return `sv:round:${round}:workers`;
  }

  private workerCompositeKey(address: string, workerName: string) {
    return `${address}${RoundStateService.WORKER_SEPARATOR}${workerName}`;
  }

  private roundWorkerKey(round: string, address: string, workerName: string) {
    return `sv:round:${round}:worker:${this.workerCompositeKey(address, workerName)}`;
  }

  private roundLeaderboardKey(round: string) {
    return `sv:round:${round}:leaderboard`;
  }

  private archiveLockKey(round: string) {
    return `sv:archive_lock:${round}`;
  }

  async getCurrentRound(): Promise<string | null> {
    return this.redis.get(this.currentRoundKey());
  }

  async setCurrentRound(round: string, ts?: number): Promise<void> {
    const startedAtKey = this.roundStartedAtKey(round);
    const multi = this.redis.multi();

    multi.set(this.currentRoundKey(), round);
    multi.setnx(startedAtKey, String(ts ?? Date.now() / 1000));

    await multi.exec();
  }

  async tryAcquireArchiveLock(round: string): Promise<boolean> {
    const result = await this.redis.set(
      this.archiveLockKey(round),
      "1",
      "EX",
      60,
      "NX",
    );

    return result === "OK";
  }

  async ingestShare(
    message: RawShareMessage,
    level = 1,
  ): Promise<{
    currentRound: string;
    changedRound: boolean;
    previousRound: string | null;
    updatedWorker: LiveWorkerState | null;
  }> {
    const share = message.share;
    const round = share.round;
    const workerName = share.workername;
    const address = share.address;
    const displayName = share.worker || workerName;
    const bestIncoming = Number(share.sdiff) || 0;
    const lastShareTs = Number(share.ts) || Date.now() / 1000;

    const currentRound = await this.getCurrentRound();

    const incomingRoundNum = parseInt(round, 16);
    const currentRoundNum = currentRound ? parseInt(currentRound, 16) : null;

    if (Number.isNaN(incomingRoundNum)) {
      this.logger.warn(`Round invalide reçu: ${round}`);
      return {
        currentRound: currentRound ?? round,
        changedRound: false,
        previousRound: null,
        updatedWorker: null,
      };
    }

    const changedRound =
      currentRoundNum !== null && incomingRoundNum > currentRoundNum;

    const staleRound =
      currentRoundNum !== null && incomingRoundNum < currentRoundNum;

    if (staleRound) {
      this.logger.warn(
        `Share ignoré car round en retard: incoming=${round}, current=${currentRound}`,
      );

      return {
        currentRound: currentRound!,
        changedRound: false,
        previousRound: null,
        updatedWorker: null,
      };
    }

    const previousRound = changedRound ? currentRound : null;

    if (!currentRound || changedRound) {
      await this.setCurrentRound(round, lastShareTs);
    }

    const workerCompositeKey = this.workerCompositeKey(address, workerName);
    const workerKey = this.roundWorkerKey(round, address, workerName);
    const workersSetKey = this.roundWorkersSetKey(round);
    const leaderboardKey = this.roundLeaderboardKey(round);

    const existing = (await this.redis.hgetall(
      workerKey,
    )) as RoundWorkerRedisState;

    const currentBest = Number(existing.bestShare || 0);
    const currentShares = Number(existing.sharesCount || 0);
    const currentLevel = Number(existing.level || level || 1);

    const nextBest = Math.max(currentBest, bestIncoming);
    const nextShares = currentShares + 1;

    const multi = this.redis.multi();
    multi.sadd(workersSetKey, workerCompositeKey);
    multi.hset(workerKey, {
      workerName,
      address,
      displayName,
      bestShare: String(nextBest),
      sharesCount: String(nextShares),
      lastShareTs: String(lastShareTs),
      level: String(currentLevel),
    });
    multi.zadd(leaderboardKey, nextBest, workerCompositeKey);
    await multi.exec();

    return {
      currentRound: round,
      changedRound,
      previousRound,
      updatedWorker: {
        workerName,
        address,
        displayName,
        bestShare: nextBest,
        sharesCount: nextShares,
        lastShareTs,
        size: this.computeSize(nextBest),
        round,
        level: currentLevel,
      },
    };
  }

  async getLiveRoundState(round: string): Promise<LiveWorkerState[]> {
    const workerKeys = await this.redis.smembers(this.roundWorkersSetKey(round));

    if (!workerKeys.length) {
      return [];
    }

    const pipeline = this.redis.pipeline();

    for (const workerCompositeKey of workerKeys) {
      pipeline.hgetall(`sv:round:${round}:worker:${workerCompositeKey}`);
    }

    const responses = await pipeline.exec();
    const result: LiveWorkerState[] = [];

    for (const [, rawValue] of responses ?? []) {
      const raw = rawValue as RoundWorkerRedisState;

      if (!raw?.workerName || !raw?.address) {
        continue;
      }

      result.push({
        workerName: raw.workerName,
        address: raw.address,
        displayName: raw.displayName,
        bestShare: Number(raw.bestShare || 0),
        sharesCount: Number(raw.sharesCount || 0),
        lastShareTs: Number(raw.lastShareTs || 0),
        size: this.computeSize(Number(raw.bestShare || 0)),
        round,
        level: Number(raw.level || 1),
      });
    }

    result.sort((a, b) => b.bestShare - a.bestShare);
    return result;
  }

  async getArchivedSnapshot(round: string) {
    const workerKeys = await this.redis.smembers(this.roundWorkersSetKey(round));
    const startedAt = await this.redis.get(this.roundStartedAtKey(round));

    if (!workerKeys.length) {
      return {
        roundKey: round,
        startedAt: startedAt ? Number(startedAt) : null,
        endedAt: Date.now() / 1000,
        workers: [],
      };
    }

    const pipeline = this.redis.pipeline();

    for (const workerCompositeKey of workerKeys) {
      pipeline.hgetall(`sv:round:${round}:worker:${workerCompositeKey}`);
    }

    const responses = await pipeline.exec();
    const result: ArchivedRoundWorker[] = [];

    for (const [, rawValue] of responses ?? []) {
      const raw = rawValue as RoundWorkerRedisState;

      if (!raw?.workerName || !raw?.address) {
        continue;
      }

      result.push({
        workerName: raw.workerName,
        address: raw.address,
        displayName: raw.displayName,
        bestShare: Number(raw.bestShare || 0),
        sharesCount: Number(raw.sharesCount || 0),
        lastShareTs: Number(raw.lastShareTs || 0),
      });
    }

    result.sort((a, b) => b.bestShare - a.bestShare);

    return {
      roundKey: round,
      startedAt: startedAt ? Number(startedAt) : null,
      endedAt: Date.now() / 1000,
      workers: result,
    };
  }

  async resetForNewRound(previousRound: string, newRound: string, ts?: number) {
    await this.setCurrentRound(newRound, ts);

    const pattern = `sv:round:${previousRound}:*`;
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );

      cursor = nextCursor;

      if (keys.length > 0) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }

  private computeSize(bestShare: number): number {
    return Math.max(0.8, Math.min(4, 1 + Math.log10(bestShare + 1) * 0.35));
  }

  private archivedRoundKey(round: string) {
    return `sv:archived_round:${round}`;
  }

  async isRoundArchived(round: string): Promise<boolean> {
    const value = await this.redis.get(this.archivedRoundKey(round));
    return value === "1";
  }

  async markRoundArchived(round: string): Promise<void> {
    await this.redis.set(this.archivedRoundKey(round), "1", "EX", 86400);
  }
}