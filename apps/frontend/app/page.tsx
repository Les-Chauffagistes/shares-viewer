import { LiveArena } from "@/components/live-arena";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold">Shares Viewer</h1>
        <p className="mt-2 text-neutral-400">
          Visualisation temps réel des workers de la pool
        </p>

        <div className="mt-8">
          <LiveArena />
        </div>
      </div>
    </main>
  );
}