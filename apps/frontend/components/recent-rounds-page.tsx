import { unstable_noStore as noStore } from "next/cache";
import { RoundTable, type WorkerRoundStat } from "./RoundTable";

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
  noStore();

  const baseUrl = process.env.BACKEND_HTTP_URL;

  if (!baseUrl) {
    console.error("[RecentRoundsPage] BACKEND_HTTP_URL manquante");
    return [];
  }

  try {
    const res = await fetch(`${baseUrl}/api/history`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[RecentRoundsPage] Erreur API /api/history:",
        res.status,
        await res.text(),
      );
      return [];
    }

    const text = await res.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      console.error("[RecentRoundsPage] /api/history n'a pas renvoyé un tableau");
      return [];
    }

    return data as RoundArchive[];
  } catch (error) {
    console.error("[RecentRoundsPage] fetch /api/history failed", error);
    return [];
  }
}

function roundHexToDecimal(round: string): string {
  const parsed = parseInt(round, 16);
  if (Number.isNaN(parsed)) return round;
  return `${round} (${parsed.toLocaleString("fr-FR")})`;
}

export async function RecentRoundsPage() {
  noStore();

  const rounds = await getHistory();

  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
        Aucun bloc archivé pour le moment.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {rounds.map((round) => (
        <article
          key={round.id}
          className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-400">Bloc</p>
              <h2 className="text-2xl font-bold">
                {roundHexToDecimal(round.roundKey)}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Fin : {new Date(round.endedAt).toLocaleString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
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
              <div className="rounded-xl bg-neutral-950 px-3 py-2">
                <p className="text-neutral-400">Top affiché</p>
                <p className="font-semibold">
                  {Math.min(round.workerStats.length, 10)}
                </p>
              </div>
            </div>
          </div>

          <RoundTable roundKey={round.roundKey} workers={round.workerStats} />
        </article>
      ))}
    </section>
  );
}