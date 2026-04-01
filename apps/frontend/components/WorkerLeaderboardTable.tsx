"use client";

import { useMemo, useState } from "react";
import { formatHash } from "@/components/utils/format";

export type WorkerProfile = {
  id: number;
  address: string;
  isPublic: boolean;
  worker: string;
  bestShareEver: number;
  totalShares: number;
  roundsParticipated: number;
  currentStreak: number;
  bestStreak: number;
  xp: number;
  level: number;
  createdAt: string;
  updatedAt: string;
};

type WorkerLeaderboardTableProps = {
  workers: WorkerProfile[];
};

function buildDisplayName(worker: WorkerProfile): string {
  return `${worker.address}.${worker.worker}`;
}

export function WorkerLeaderboardTable({
  workers,
}: WorkerLeaderboardTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedWorkers = useMemo(() => {
    return showAll ? workers : workers.slice(0, 25);
  }, [showAll, workers]);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="px-2 py-3">#</th>
              <th className="px-2 py-3">Worker</th>
              <th className="px-2 py-3">Level</th>
              <th className="px-2 py-3">XP</th>
              <th className="px-2 py-3">Best share ever</th>
              <th className="px-2 py-3">Shares totales</th>
              <th className="px-2 py-3">Rounds</th>
              <th className="px-2 py-3">Streak actuelle</th>
              <th className="px-2 py-3">Meilleure streak</th>
              <th className="px-2 py-3">Dernière mise à jour</th>
            </tr>
          </thead>
          <tbody>
            {displayedWorkers.map((worker, index) => (
              <tr
                key={worker.id}
                className="border-b border-neutral-800/60"
              >
                <td className="px-2 py-3 font-semibold">{index + 1}</td>
                <td className="px-2 py-3">{buildDisplayName(worker)}</td>
                <td className="px-2 py-3">{worker.level}</td>
                <td className="px-2 py-3">
                  {(Math.round(worker.xp * 100) / 100).toLocaleString("fr-FR")}
                </td>
                <td className="px-2 py-3">
                  {formatHash(worker.bestShareEver)}
                </td>
                <td className="px-2 py-3">
                  {worker.totalShares.toLocaleString("fr-FR")}
                </td>
                <td className="px-2 py-3">
                  {worker.roundsParticipated.toLocaleString("fr-FR")}
                </td>
                <td className="px-2 py-3">{worker.currentStreak}</td>
                <td className="px-2 py-3">{worker.bestStreak}</td>
                <td className="px-2 py-3 text-neutral-400">
                  {new Date(worker.updatedAt).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {workers.length > 25 && (
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