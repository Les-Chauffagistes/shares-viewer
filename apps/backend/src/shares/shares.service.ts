import { Injectable, Logger } from "@nestjs/common";
import { RawShareMessage } from "@shares-viewer/types";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { RoundStateService } from "../round-state/round-state.service";
import { RoundArchiveService } from "../round-state/round-archive.service";

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly roundStateService: RoundStateService,
    private readonly roundArchiveService: RoundArchiveService,
  ) {}

  async ingest(message: RawShareMessage): Promise<void> {
    if (message.type !== "share" || !message.share?.round || !message.share?.workername) {
      return;
    }

    const result = await this.roundStateService.ingestShare(message);

    if (result.changedRound && result.previousRound) {
      const locked = await this.roundStateService.tryAcquireArchiveLock(
        result.previousRound,
      );

      if (locked) {
        this.logger.log(`Archivage du round ${result.previousRound}`);
        const snapshot = await this.roundStateService.getArchivedSnapshot(
          result.previousRound,
        );

        await this.roundArchiveService.archiveRound(snapshot);
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

    const liveWorkers = await this.roundStateService.getLiveRoundState(result.currentRound);

    this.realtimeGateway.emitWorkerUpdated({
      type: "worker_updated",
      worker: result.updatedWorker,
    });

    this.realtimeGateway.emitLiveState({
      type: "live_state",
      round: result.currentRound,
      workers: liveWorkers,
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

    return {
      round: currentRound,
      workers: await this.roundStateService.getLiveRoundState(currentRound),
    };
  }
}