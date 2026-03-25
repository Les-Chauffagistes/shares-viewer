import { Injectable, Logger } from "@nestjs/common";
import { LiveWorkerState, RawShareMessage } from "@shares-viewer/types";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { RoundStateService } from "../round-state/round-state.service";
import { RoundArchiveService } from "../round-state/round-archive.service";

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
            await this.roundArchiveService.archiveRound(snapshot);
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
    const updatedPublicWorker = this.anonymizeWorkers([result.updatedWorker])[0];

    this.realtimeGateway.emitWorkerShareUpdated({
      type: "worker_share_updated",
      worker: updatedPublicWorker,
    });

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
    const sortedWorkers = [...workers].sort((a, b) => {
      const byAddress = a.address.localeCompare(b.address);
      if (byAddress !== 0) return byAddress;

      return a.workerName.localeCompare(b.workerName);
    });

    const workerAliasMap = new Map<string, string>();
    let counter = 1;

    for (const worker of sortedWorkers) {
      if (!workerAliasMap.has(worker.workerName)) {
        workerAliasMap.set(worker.workerName, `worker${counter}`);
        counter += 1;
      }
    }

    return workers
      .map((worker) => {
        const anonymousWorkerName =
          worker.address === SharesService.PUBLIC_ADDRESS
            ? worker.workerName
            : (workerAliasMap.get(worker.workerName) ?? "worker?");

        const displayAddress = this.toDisplayAddress(worker.address);

        return {
          ...worker,
          address: displayAddress,
          workerName: anonymousWorkerName,
          displayName: `${displayAddress}.${anonymousWorkerName}`,
        };
      })
      .sort((a, b) => b.bestShare - a.bestShare);
  }

  private toDisplayAddress(address: string): string {
    if (address === SharesService.PUBLIC_ADDRESS) {
      return address;
    }

    if (address.length <= 10) {
      return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}