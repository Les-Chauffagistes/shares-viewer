import { Injectable, Logger } from "@nestjs/common";
import { RawShareMessage, WorkerState } from "@shares-viewer/types";
import { RealtimeGateway } from "../realtime/realtime.gateway";

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  private currentRound: string | null = null;
  private workers = new Map<string, WorkerState>();
  private history: { round: string; workers: WorkerState[] }[] = [];
  private readonly maxHistoryRounds = 20;

  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  ingest(message: RawShareMessage): void {
    if (message.type !== "share" || !message.share) return;

    const share = message.share;
    const round = share.round;
    const workerName = share.workername;

    if (!round || !workerName) return;

    const workerKey = workerName.toLowerCase();

    if (!this.currentRound) {
      this.currentRound = round;
      this.logger.log(`Round initial détecté: ${round}`);
    }

    if (this.currentRound !== round) {
      const previousRound = this.currentRound;

      this.flushCurrentRound();
      this.currentRound = round;
      this.workers.clear();

      this.logger.log(`Nouveau round détecté: ${round}`);

      this.realtimeGateway.emitRoundReset({
        previousRound,
        newRound: round,
        history: this.history,
      });
    }

    const current = this.workers.get(workerKey);
    const bestSdiff = Math.max(current?.bestSdiff ?? 0, Number(share.sdiff) || 0);
    const sharesCount = (current?.sharesCount ?? 0) + 1;

    const next: WorkerState = {
      workerName,
      displayName: share.worker || workerName,
      bestSdiff,
      sharesCount,
      lastShareTs: Number(share.ts) || Date.now() / 1000,
      size: this.computeSize(bestSdiff),
      round,
    };

    this.workers.set(workerKey, next);

    this.realtimeGateway.emitWorkerUpdated({
      type: "worker_updated",
      worker: next,
    });

    this.realtimeGateway.emitLiveState({
      type: "live_state",
      round: this.currentRound,
      workers: this.getSortedWorkers(),
    });
  }

  getLiveState() {
    return {
      round: this.currentRound,
      workers: this.getSortedWorkers(),
    };
  }

  getHistory() {
    return this.history;
  }

  private flushCurrentRound() {
    if (!this.currentRound) return;

    this.history.unshift({
      round: this.currentRound,
      workers: this.getSortedWorkers(),
    });

    this.history = this.history.slice(0, this.maxHistoryRounds);
  }

  private getSortedWorkers() {
    return Array.from(this.workers.values()).sort(
      (a, b) => b.bestSdiff - a.bestSdiff,
    );
  }

  private computeSize(bestSdiff: number): number {
    return Math.max(0.8, Math.min(4, 1 + Math.log10(bestSdiff + 1) * 0.35));
  }
}