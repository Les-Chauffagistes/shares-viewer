import Link from "next/link";
import Image from "next/image";

export function TopNav() {
  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold text-white sm:text-lg"
        >
          <Image
            src="/logos/chauffagistes.webp"
            alt="Shares Viewer"
            width={28}
            height={28}
            className="rounded-md sm:h-7 sm:w-7"
          />
          <span className="truncate">Shares Viewer</span>
        </Link>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 sm:px-4"
            >
              Live Arena
            </Link>

            <Link
              href="/history"
              className="whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 sm:px-4"
            >
              Historique
            </Link>

            <Link
              href="/workers"
              className="whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 sm:px-4"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}