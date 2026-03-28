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
import {
  ResolvedWorkerIdentity,
  WorkerIdentityService,
} from "./worker-identity.service";

type PublicLiveWorkerState = Omit<LiveWorkerState, "address" | "workerName"> & {
  address: string;
  workerName: string;
  displayName: string;
  uniqueKey: string;
};

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  private liveStateBroadcastTimer: NodeJS.Timeout | null = null;
  private pendingLiveStateRound: string | null = null;
  private readonly LIVE_STATE_BROADCAST_DEBOUNCE_MS = 500;

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly roundStateService: RoundStateService,
    private readonly roundArchiveService: RoundArchiveService,
    private readonly workerIdentityService: WorkerIdentityService,
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

    const updatedPublicWorker = await this.toPublicWorker(result.updatedWorker);

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
            const archiveSnapshot =
              await this.buildArchivedSnapshotForDb(snapshot);

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

    this.realtimeGateway.emitWorkerShareUpdated({
      type: "worker_share_updated",
      worker: updatedPublicWorker,
    });

    this.scheduleLiveStateBroadcast(result.currentRound);
  }

  async getLiveState() {
    const currentRound = await this.roundStateService.getCurrentRound();

    if (!currentRound) {
      return {
        round: null,
        workers: [],
      };
    }

    const liveWorkersRaw =
      await this.roundStateService.getLiveRoundState(currentRound);

    return {
      round: currentRound,
      workers: await this.anonymizeWorkers(liveWorkersRaw),
    };
  }

  private scheduleLiveStateBroadcast(round: string): void {
    this.pendingLiveStateRound = round;

    if (this.liveStateBroadcastTimer) {
      return;
    }

    this.liveStateBroadcastTimer = setTimeout(async () => {
      const roundToBroadcast = this.pendingLiveStateRound;

      this.liveStateBroadcastTimer = null;
      this.pendingLiveStateRound = null;

      if (!roundToBroadcast) {
        return;
      }

      try {
        const liveWorkersRaw =
          await this.roundStateService.getLiveRoundState(roundToBroadcast);

        const publicWorkers = await this.anonymizeWorkers(liveWorkersRaw);

        this.realtimeGateway.emitLiveState({
          type: "live_state",
          round: roundToBroadcast,
          workers: publicWorkers,
        });
      } catch (error) {
        this.logger.error(
          `Impossible d'émettre le live state du round ${roundToBroadcast}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }, this.LIVE_STATE_BROADCAST_DEBOUNCE_MS);
  }

  private async toPublicWorker(
    worker: LiveWorkerState,
  ): Promise<PublicLiveWorkerState> {
    const identity = await this.workerIdentityService.resolve(
      worker.address,
      worker.workerName,
    );

    return {
      ...worker,
      address: identity.addressLabel,
      workerName: identity.workerLabel,
      displayName: identity.displayName,
      uniqueKey: `${identity.addressId}::${identity.rawWorkerName}`,
    };
  }

  private async anonymizeWorkers(
    workers: LiveWorkerState[],
  ): Promise<PublicLiveWorkerState[]> {
    const identities = await Promise.all(
      workers.map((worker) =>
        this.workerIdentityService.resolve(worker.address, worker.workerName),
      ),
    );

    return workers
      .map((worker, index) => {
        const identity = identities[index];

        return {
          ...worker,
          address: identity.addressLabel,
          workerName: identity.workerLabel,
          displayName: identity.displayName,
          uniqueKey: `${identity.addressId}::${identity.rawWorkerName}`,
        };
      })
      .sort((a, b) => b.bestShare - a.bestShare);
  }

  private async buildArchivedSnapshotForDb(
    snapshot: ArchivedRoundSnapshot,
  ): Promise<ArchivedRoundSnapshotForDb> {
    const identities = await Promise.all(
      snapshot.workers.map((worker) =>
        this.workerIdentityService.resolve(worker.address, worker.workerName),
      ),
    );

    const workers = snapshot.workers
      .map((worker, index) => {
        const identity: ResolvedWorkerIdentity = identities[index];

        return {
          workerName: worker.workerName,
          worker: identity.workerLabel,
          addressId: identity.addressId,
          addressLabel: identity.addressLabel,
          rawAddress: identity.rawAddress,
          isPublic: identity.isPublic,
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
}