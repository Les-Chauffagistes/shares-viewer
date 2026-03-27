import { Injectable, Logger } from "@nestjs/common";
import {
  ArchivedRoundSnapshot,
  LiveWorkerState,
  RawShareMessage,
} from "@shares-viewer/types";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { RoundStateService } from "../round-state/round-state.service";
import { RoundArchiveService } from "../round-state/round-archive.service";
import { ArchivedRoundSnapshotForDb } from "./types/archive-db.types";

type PublicLiveWorkerState = LiveWorkerState & {
  realWorkerName?: never;
};

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  private static readonly PUBLIC_ADDRESS =
    "bc1qqp9zq4an6nyzhcspz2xfmkcf8rj0p6w94a5gyeu2a7rghxjhnqqsvymz5m";

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly roundStateService: RoundStateService,
    private readonly roundArchiveService: RoundArchiveService,
  ) {}

  async ingest(message: RawShareMessage): Promise<void> {
    if (
      message.type !== "share" ||
      !message.share?.round ||
      !message.share?.workername
    ) {
      return;
    }

    const result = await this.roundStateService.ingestShare(message);

    if (!result.updatedWorker) {
      return;
    }

    const updatedWorker = result.updatedWorker;

    if (result.changedRound && result.previousRound) {
      const alreadyArchived = await this.roundStateService.isRoundArchived(
        result.previousRound,
      );

      if (!alreadyArchived) {
        const locked = await this.roundStateService.tryAcquireArchiveLock(
          result.previousRound,
        );

        if (locked) {
          this.logger.log(`Archivage du round ${result.previousRound}`);

          const snapshot = await this.roundStateService.getArchivedSnapshot(
            result.previousRound,
          );

          if (!snapshot.workers.length) {
            this.logger.warn(
              `Archivage annulé pour ${result.previousRound}: snapshot vide`,
            );
          } else {
            const archiveSnapshot = this.buildArchivedSnapshotForDb(snapshot);

            await this.roundArchiveService.archiveRound(archiveSnapshot);
            await this.roundStateService.markRoundArchived(result.previousRound);
          }

          await this.roundStateService.resetForNewRound(
            result.previousRound,
            result.currentRound,
            message.share.ts,
          );

          this.realtimeGateway.emitRoundReset({
            previousRound: result.previousRound,
            newRound: result.currentRound,
          });
        }
      }
    }

    const liveWorkersRaw = await this.roundStateService.getLiveRoundState(
      result.currentRound,
    );

    const publicWorkers = this.anonymizeWorkers(liveWorkersRaw);

    const updatedPublicWorker = this.anonymizeWorkers([
      updatedWorker,
      ...liveWorkersRaw.filter(
        (worker) =>
          !(
            worker.address === updatedWorker.address &&
            worker.workerName === updatedWorker.workerName
          ),
      ),
    ]).find(
      (worker) =>
        worker.lastShareTs === updatedWorker.lastShareTs &&
        worker.bestShare === updatedWorker.bestShare &&
        worker.sharesCount === updatedWorker.sharesCount,
    );

    if (updatedPublicWorker) {
      this.realtimeGateway.emitWorkerShareUpdated({
        type: "worker_share_updated",
        worker: updatedPublicWorker,
      });
    }

    this.realtimeGateway.emitLiveState({
      type: "live_state",
      round: result.currentRound,
      workers: publicWorkers,
    });
  }

  async getLiveState() {
    const currentRound = await this.roundStateService.getCurrentRound();

    if (!currentRound) {
      return {
        round: null,
        workers: [],
      };
    }

    const liveWorkersRaw = await this.roundStateService.getLiveRoundState(
      currentRound,
    );

    return {
      round: currentRound,
      workers: this.anonymizeWorkers(liveWorkersRaw),
    };
  }

  private anonymizeWorkers(workers: LiveWorkerState[]): PublicLiveWorkerState[] {
    const { workerAliasMap } = this.buildWorkerAliasMap(workers);

    return workers
      .map((worker) => {
        const displayAddress = this.toDisplayAddress(worker.address);

        const anonymousWorkerName =
          worker.address === SharesService.PUBLIC_ADDRESS
            ? worker.workerName
            : (workerAliasMap.get(
                this.workerAliasKey(worker.address, worker.workerName),
              ) ?? "worker?");

        return {
          ...worker,
          address: displayAddress,
          workerName: anonymousWorkerName,
          displayName: `${displayAddress}.${anonymousWorkerName}`,
        };
      })
      .sort((a, b) => b.bestShare - a.bestShare);
  }

  private buildArchivedSnapshotForDb(
    snapshot: ArchivedRoundSnapshot,
  ): ArchivedRoundSnapshotForDb {
    const { workerAliasMap } = this.buildWorkerAliasMap(snapshot.workers);

    const workers = snapshot.workers
      .map((worker) => {
        const isPublic = worker.address === SharesService.PUBLIC_ADDRESS;

        const realWorker = this.extractWorkerSuffix(worker.workerName);

        const workerAlias = isPublic
          ? realWorker
          : (workerAliasMap.get(
              this.workerAliasKey(worker.address, worker.workerName),
            ) ?? "worker?");

        const addressId = this.toAddressId(worker.address);
        const addressLabel = this.toDisplayAddress(worker.address);

        return {
          workerName: worker.workerName,
          worker: workerAlias,
          addressId,
          addressLabel,
          rawAddress: worker.address,
          isPublic,
          bestShare: worker.bestShare,
          sharesCount: worker.sharesCount,
          lastShareTs: worker.lastShareTs,
        };
      })
      .sort((a, b) => b.bestShare - a.bestShare);

    return {
      roundKey: snapshot.roundKey,
      startedAt: snapshot.startedAt ?? null,
      endedAt: snapshot.endedAt,
      workers,
    };
  }

  private buildWorkerAliasMap(
    workers: Array<{ address: string; workerName: string }>,
  ): {
    workerAliasMap: Map<string, string>;
  } {
    const sorted = [...workers].sort((a, b) => {
      const byAddress = a.address.localeCompare(b.address);
      if (byAddress !== 0) return byAddress;

      return a.workerName.localeCompare(b.workerName);
    });

    const workerAliasMap = new Map<string, string>();
    const workerCounterByAddress = new Map<string, number>();

    for (const worker of sorted) {
      if (worker.address === SharesService.PUBLIC_ADDRESS) {
        continue;
      }

      const aliasKey = this.workerAliasKey(worker.address, worker.workerName);

      if (!workerAliasMap.has(aliasKey)) {
        const nextWorkerIndex =
          (workerCounterByAddress.get(worker.address) ?? 0) + 1;

        workerCounterByAddress.set(worker.address, nextWorkerIndex);
        workerAliasMap.set(aliasKey, `worker${nextWorkerIndex}`);
      }
    }

    return { workerAliasMap };
  }

  private workerAliasKey(address: string, workerName: string): string {
    return `${address}::${workerName}`;
  }

  private toDisplayAddress(address: string): string {
    if (address === SharesService.PUBLIC_ADDRESS) {
      return "chauff_pool";
    }

    if (address.length <= 11) {
      return address;
    }

    return `${address.slice(0, 7)}...${address.slice(-4)}`;
  }

  private toAddressId(address: string): string {
    if (address === SharesService.PUBLIC_ADDRESS) {
      return "chauff_pool";
    }

    return address;
  }

  private extractWorkerFromWorkerName(workerName: string): string {
    const lastDotIndex = workerName.lastIndexOf(".");

    if (lastDotIndex === -1 || lastDotIndex === workerName.length - 1) {
      return workerName;
    }

    return workerName.slice(lastDotIndex + 1);
  }

  private extractWorkerSuffix(workerName: string): string {
    const lastDotIndex = workerName.lastIndexOf(".");

    if (lastDotIndex === -1 || lastDotIndex === workerName.length - 1) {
      return workerName;
    }

    return workerName.slice(lastDotIndex + 1);
  }
}