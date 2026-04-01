"use client";

import { ArenaWorker } from "@/lib/live-arena/types";
import { getWalkerTitleForLevel } from "@/lib/live-arena/sprites";
import { extractMinerName } from "./helpers";
import { formatHash } from "@/components/utils/format";

type Props = {
  worker: ArenaWorker;
};

export function WorkerTooltip({ worker }: Props) {
  const level = worker.level ?? 1;
  const currentTitle = getWalkerTitleForLevel(level);

  return (
    <div className="absolute right-4 top-4 w-[280px] rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm text-neutral-400">Worker</p>
      <h3 className="truncate text-lg font-bold">{worker.displayName}</h3>

      <div className="mt-4 space-y-2 text-sm text-neutral-300">
        <p>
          Niveau <span className="text-neutral-400">{level}</span>
        </p>
        <p>
          Titre actuel{" "}
          <span className="font-semibold text-yellow-300">{currentTitle}</span>
        </p>
        <p>
          Best share{" "}
          <span className="font-semibold text-white">
            {formatHash(worker.bestShare)}
          </span>
        </p>
        <p>
          Shares{" "}
          <span className="font-semibold text-white">{worker.sharesCount}</span>
        </p>
        <p>
          Worker{" "}
          <span className="text-neutral-400">
            {extractMinerName(worker.workerName)}
          </span>
        </p>
        <p>
          Adresse{" "}
          <span className="break-all text-neutral-400">{worker.address}</span>
        </p>
        <p>
          Position{" "}
          <span className="text-neutral-400">
            {Math.round(worker.x)} / {Math.round(worker.y)}
          </span>
        </p>
      </div>
    </div>
  );
}