import { LiveArena } from "@/components/live-arena";
import { RecentRounds } from "@/components/recent-rounds";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Shares Viewer</h1>
          <p className="text-neutral-400">
            Visualisation temps réel des workers et archivage des 5 derniers blocs
          </p>
        </header>

        <LiveArena />

        <RecentRounds />
      </div>
    </main>
  );
}