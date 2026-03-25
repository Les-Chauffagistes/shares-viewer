type WorkerRoundStat = {
  id: number;
  roundKey: string;
  workerName: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  rank: number;
  participated: boolean;
  streakAtTime: number;
  xpGained: number;
  totalXpAfter: number;
  levelAfter: number;
};

type RoundArchive = {
  id: number;
  roundKey: string;
  startedAt: string | null;
  endedAt: string;
  workersCount: number;
  sharesCount: number;
  bestShare: number;
  createdAt: string;
  workerStats: WorkerRoundStat[];
};

async function getHistory(): Promise<RoundArchive[]> {
  const httpUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL;

  if (!httpUrl) {
    return [];
  }

  const res = await fetch(`${httpUrl}/history`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export async function RecentRounds() {
  const rounds = await getHistory();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">5 derniers blocs</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Historique archivé dans PostgreSQL
        </p>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
          Aucun bloc archivé pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => (
            <article
              key={round.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-400">Bloc</p>
                  <h3 className="text-xl font-semibold">{round.roundKey}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-neutral-950 px-3 py-2">
                    <p className="text-neutral-400">Workers</p>
                    <p className="font-semibold">{round.workersCount}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-950 px-3 py-2">
                    <p className="text-neutral-400">Shares</p>
                    <p className="font-semibold">{round.sharesCount}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-950 px-3 py-2">
                    <p className="text-neutral-400">Best</p>
                    <p className="font-semibold">
                      {Math.round(round.bestShare).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-neutral-400">
                    <tr className="border-b border-neutral-800">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Worker</th>
                      <th className="px-2 py-2">Best share</th>
                      <th className="px-2 py-2">Shares</th>
                      <th className="px-2 py-2">Streak</th>
                      <th className="px-2 py-2">XP</th>
                      <th className="px-2 py-2">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.workerStats.slice(0, 10).map((worker) => (
                      <tr
                        key={`${round.roundKey}-${worker.workerName}`}
                        className="border-b border-neutral-800/60"
                      >
                        <td className="px-2 py-2 font-semibold">{worker.rank}</td>
                        <td className="px-2 py-2">{worker.displayName}</td>
                        <td className="px-2 py-2">
                          {Math.round(worker.bestShare).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-2 py-2">{worker.sharesCount}</td>
                        <td className="px-2 py-2">{worker.streakAtTime}</td>
                        <td className="px-2 py-2">
                          {Math.round(worker.xpGained * 100) / 100}
                        </td>
                        <td className="px-2 py-2">{worker.levelAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}