import { LiveArenaCanvas } from "@/components/live-arena-canvas";
import { TopNav } from "@/components/top-nav";


export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      <div className="mx-auto max-w-7xl space-y-10 p-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Shares Viewer</h1>
          <p className="text-neutral-400">
            Visualisation temps réel des workers dans une arène 2D
          </p>
        </header>

        <LiveArenaCanvas />
      </div>
    </main>
  );
}