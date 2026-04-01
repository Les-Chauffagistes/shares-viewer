"use client";

import { formatHash } from "@/components/utils/format";
import { useMemo, useState } from "react";

export type WorkerRoundStat = {
  id: number;
  roundKey: string;
  worker: string;
  address: string;
  isPublic: boolean;
  bestShare: number;
  sharesCount: number;
  rank: number;
  participated: boolean;
  streakAtTime: number;
  xpGained: number;
  totalXpAfter: number;
  levelAfter: number;
  createdAt: string;
};

type RoundTableProps = {
  roundKey: string;
  workers: WorkerRoundStat[];
};

function buildArchivedDisplayName(worker: WorkerRoundStat): string {
  return `${worker.address}.${worker.worker}`;
}

export function RoundTable({ roundKey, workers }: RoundTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedWorkers = useMemo(() => {
    return showAll ? workers : workers.slice(0, 10);
  }, [showAll, workers]);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="px-2 py-3">#</th>
              <th className="px-2 py-3">Worker</th>
              <th className="px-2 py-3">Best share</th>
              <th className="px-2 py-3">Shares</th>
              <th className="px-2 py-3">Streak</th>
              <th className="px-2 py-3">XP</th>
              <th className="px-2 py-3">Level</th>
            </tr>
          </thead>
          <tbody>
            {displayedWorkers.map((worker) => (
              <tr
                key={`${roundKey}-${worker.id}`}
                className="border-b border-neutral-800/60"
              >
                <td className="px-2 py-3 font-semibold">{worker.rank}</td>
                <td className="px-2 py-3">{buildArchivedDisplayName(worker)}</td>
                <td className="px-2 py-3">
                  {formatHash(worker.bestShare)}
                </td>
                <td className="px-2 py-3">{worker.sharesCount}</td>
                <td className="px-2 py-3">{worker.streakAtTime}</td>
                <td className="px-2 py-3">
                  {Math.round(worker.xpGained * 100) / 100}
                </td>
                <td className="px-2 py-3">{worker.levelAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {workers.length > 10 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            {showAll
              ? "Afficher moins"
              : `Afficher tous les workers (${workers.length})`}
          </button>
        </div>
      )}
    </div>
  );
}