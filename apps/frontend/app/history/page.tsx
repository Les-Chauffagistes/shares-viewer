import { TopNav } from "@/components/top-nav";
import { RecentRoundsPage } from "@/components/recent-rounds-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
            Historique des blocs
          </h1>
          <p className="text-sm text-neutral-400 sm:text-base">
            Archivage des rounds précédents
          </p>
        </header>

        <RecentRoundsPage />
      </div>
    </main>
  );
}