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

type PublicLiveWorkerState = LiveWorkerState & {
  realWorkerName?: never;
};

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

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
            const archiveSnapshot = await this.buildArchivedSnapshotForDb(snapshot);

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

    const publicWorkers = await this.anonymizeWorkers(liveWorkersRaw);

    const updatedPublicWorker = (
      await this.anonymizeWorkers([
        updatedWorker,
        ...liveWorkersRaw.filter(
          (worker) =>
            !(
              worker.address === updatedWorker.address &&
              worker.workerName === updatedWorker.workerName
            ),
        ),
      ])
    ).find(
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
      workers: await this.anonymizeWorkers(liveWorkersRaw),
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