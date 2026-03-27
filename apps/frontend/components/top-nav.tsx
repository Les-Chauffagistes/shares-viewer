import Link from "next/link";

export function TopNav() {
  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <Link href="/" className="text-lg font-bold text-white">
          Shares Viewer
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900"
          >
            Live Arena
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900"
          >
            Historique
          </Link>
        </div>
      </div>
    </nav>
  );
}