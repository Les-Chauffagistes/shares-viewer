import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import {
  ArchivedRoundWorker,
  LiveWorkerState,
  RawShareMessage,
} from "@shares-viewer/types";

type RoundWorkerRedisState = {
  workerName: string;
  displayName: string;
  bestShare: string;
  sharesCount: string;
  lastShareTs: string;
};

@Injectable()
export class RoundStateService {
  private readonly logger = new Logger(RoundStateService.name);

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

  private roundWorkerKey(round: string, workerName: string) {
    return `sv:round:${round}:worker:${workerName}`;
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
    const multi = this.redis.multi();
    multi.set(this.currentRoundKey(), round);

    const startedAtExists = await this.redis.exists(this.roundStartedAtKey(round));
    if (!startedAtExists) {
      multi.set(this.roundStartedAtKey(round), String(ts ?? Date.now() / 1000));
    }

    await multi.exec();
  }

  async tryAcquireArchiveLock(round: string): Promise<boolean> {
    const result = await this.redis.set(
      this.archiveLockKey(round),
      "1",
      "EX",
      10,
      "NX",
    );

    return result === "OK";
  }

  async ingestShare(message: RawShareMessage): Promise<{
    currentRound: string;
    changedRound: boolean;
    previousRound: string | null;
    updatedWorker: LiveWorkerState;
  }> {
    const share = message.share;
    const round = share.round;
    const workerName = share.workername;
    const displayName = share.worker || workerName;
    const bestIncoming = Number(share.sdiff) || 0;
    const lastShareTs = Number(share.ts) || Date.now() / 1000;

    const currentRound = await this.getCurrentRound();
    const changedRound = !!currentRound && currentRound !== round;
    const previousRound = currentRound;

    if (!currentRound || changedRound) {
      await this.setCurrentRound(round, lastShareTs);
    }

    const workerKey = this.roundWorkerKey(round, workerName);
    const workersSetKey = this.roundWorkersSetKey(round);
    const leaderboardKey = this.roundLeaderboardKey(round);

    const existing = (await this.redis.hgetall(workerKey)) as RoundWorkerRedisState;
    const currentBest = Number(existing.bestShare || 0);
    const currentShares = Number(existing.sharesCount || 0);

    const nextBest = Math.max(currentBest, bestIncoming);
    const nextShares = currentShares + 1;

    const multi = this.redis.multi();
    multi.sadd(workersSetKey, workerName);
    multi.hset(workerKey, {
      workerName,
      displayName,
      bestShare: String(nextBest),
      sharesCount: String(nextShares),
      lastShareTs: String(lastShareTs),
    });
    multi.zadd(leaderboardKey, nextBest, workerName);
    await multi.exec();

    return {
      currentRound: round,
      changedRound,
      previousRound,
      updatedWorker: {
        workerName,
        displayName,
        bestShare: nextBest,
        sharesCount: nextShares,
        lastShareTs,
        size: this.computeSize(nextBest),
        round,
      },
    };
  }

  async getLiveRoundState(round: string): Promise<LiveWorkerState[]> {
    const workers = await this.redis.smembers(this.roundWorkersSetKey(round));
    const result: LiveWorkerState[] = [];

    for (const workerName of workers) {
      const raw = await this.redis.hgetall(this.roundWorkerKey(round, workerName));
      if (!raw.workerName) continue;

      result.push({
        workerName: raw.workerName,
        displayName: raw.displayName,
        bestShare: Number(raw.bestShare || 0),
        sharesCount: Number(raw.sharesCount || 0),
        lastShareTs: Number(raw.lastShareTs || 0),
        size: this.computeSize(Number(raw.bestShare || 0)),
        round,
      });
    }

    result.sort((a, b) => b.bestShare - a.bestShare);
    return result;
  }

  async getArchivedSnapshot(round: string) {
    const workers = await this.redis.smembers(this.roundWorkersSetKey(round));
    const startedAt = await this.redis.get(this.roundStartedAtKey(round));
    const result: ArchivedRoundWorker[] = [];

    for (const workerName of workers) {
      const raw = await this.redis.hgetall(this.roundWorkerKey(round, workerName));
      if (!raw.workerName) continue;

      result.push({
        workerName: raw.workerName,
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

    const keys = await this.redis.keys(`sv:round:${previousRound}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private computeSize(bestShare: number): number {
    return Math.max(0.8, Math.min(4, 1 + Math.log10(bestShare + 1) * 0.35));
  }
}