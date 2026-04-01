"use client";

import { ArenaWorker } from "@/lib/live-arena/types";
import { formatHash } from "@/components/utils/format";

type Props = {
  workers: ArenaWorker[];
};

export function Leaderboard({ workers }: Props) {
  const leaderboard = [...workers]
    .sort((a, b) => b.bestShare - a.bestShare)
    .slice(0, 8);

  return (
    <aside className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-xl font-bold">Classement live</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Top workers du bloc courant
      </p>

      <div className="mt-4 space-y-3">
        {leaderboard.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            Pas encore de données.
          </div>
        ) : (
          leaderboard.map((worker, index) => (
            <div
              key={`${worker.uniqueKey}-leaderboard`}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500">#{index + 1}</p>
                  <p className="truncate font-semibold">{worker.displayName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Best</p>
                  <p className="font-semibold text-white">
                    {formatHash(worker.bestShare)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}