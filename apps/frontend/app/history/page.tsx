import { TopNav } from "@/components/top-nav";
import { RecentRoundsPage } from "@/components/recent-rounds-page";

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      <div className="mx-auto max-w-7xl space-y-8 p-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Historique des blocs</h1>
          <p className="text-neutral-400">
            Archivage PostgreSQL des rounds précédents
          </p>
        </header>

        <RecentRoundsPage />
      </div>
    </main>
  );
}