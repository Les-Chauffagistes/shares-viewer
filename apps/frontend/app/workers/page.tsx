import { unstable_noStore as noStore } from "next/cache";
import {
  WorkerLeaderboardTable,
  type WorkerProfile,
} from "@/components/WorkerLeaderboardTable";
import { TopNav } from "@/components/top-nav";
import { formatHash } from "@/components/utils/format";

async function getWorkers(): Promise<WorkerProfile[]> {
  noStore();

  const baseUrl = process.env.BACKEND_HTTP_URL;

  if (!baseUrl) {
    console.error("[WorkersPage] BACKEND_HTTP_URL manquante");
    return [];
  }

  try {
    const res = await fetch(`${baseUrl}/api/workers`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[WorkersPage] Erreur API /api/workers:",
        res.status,
        await res.text(),
      );
      return [];
    }

    const text = await res.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      console.error("[WorkersPage] /api/workers n'a pas renvoyé un tableau");
      return [];
    }

    return data as WorkerProfile[];
  } catch (error) {
    console.error("[WorkersPage] fetch /api/workers failed", error);
    return [];
  }
}

export default async function WorkersPage() {
  noStore();

  const workers = await getWorkers();

  const totalWorkers = workers.length;
  const totalShares = workers.reduce((sum, worker) => sum + worker.totalShares, 0);
  const totalRounds = workers.reduce(
    (sum, worker) => sum + worker.roundsParticipated,
    0,
  );
  const bestShareEver = workers.reduce(
    (max, worker) => Math.max(max, worker.bestShareEver),
    0,
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:space-y-10 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
            Leaderboard global
          </h1>
          <p className="text-sm text-neutral-400 sm:text-base">
            Classement global des workers selon leur XP, leur niveau et leur
            meilleure share historique.
          </p>
        </header>

        {workers.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400 sm:p-6 sm:text-base">
            Aucun worker trouvé pour le moment.
          </div>
        ) : (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 text-xs sm:gap-3 sm:text-sm md:grid-cols-4">
              <div className="rounded-xl bg-neutral-950 px-3 py-2">
                <p className="text-neutral-400">Workers</p>
                <p className="font-semibold">{totalWorkers}</p>
              </div>

              <div className="rounded-xl bg-neutral-950 px-3 py-2">
                <p className="text-neutral-400">Shares totales</p>
                <p className="font-semibold">
                  {totalShares.toLocaleString("fr-FR")}
                </p>
              </div>

              <div className="rounded-xl bg-neutral-950 px-3 py-2">
                <p className="text-neutral-400">Best share ever</p>
                <p className="font-semibold">{formatHash(bestShareEver)}</p>
              </div>
            </div>

            <WorkerLeaderboardTable workers={workers} />
          </section>
        )}
      </div>
    </main>
  );
}