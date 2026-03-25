"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type LiveWorkerState = {
  address: string;
  workerName: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};

type LiveStatePayload = {
  type?: "live_state";
  round: string | null;
  workers: LiveWorkerState[];
};

let socket: Socket | null = null;

const PUBLIC_ADDRESS =
  "bc1qqp9zq4an6nyzhcspz2xfmkcf8rj0p6w94a5gyeu2a7rghxjhnqqsvymz5m";

function roundHexToDecimal(round: string | null): string {
  if (!round) return "Aucun";

  const parsed = parseInt(round, 16);
  if (Number.isNaN(parsed)) return round;

  return `${round} (${parsed.toLocaleString("fr-FR")})`;
}

function extractMinerName(workerName: string): string {
  if (!workerName) return "worker?";

  const parts = workerName.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : workerName;
}

function buildDisplayName(address: string, workerName: string): string {
  const minerName = extractMinerName(workerName);

  if (address === PUBLIC_ADDRESS) {
    return `chauff_pool.${minerName}`;
  }

  return `${address}.${minerName}`;
}

export function LiveArena() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<LiveWorkerState[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const httpUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL;
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;

    if (!httpUrl || !wsUrl) {
      console.error("Variables backend manquantes");
      return;
    }

    async function loadInitialState() {
      try {
        const res = await fetch(`${httpUrl}/live`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Impossible de charger /live");
        }

        const data: LiveStatePayload = await res.json();
        setRound(data.round);
        setWorkers(data.workers ?? []);
      } catch (error) {
        console.error(error);
      }
    }

    loadInitialState();

    socket = io(wsUrl, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("live_state", (payload: LiveStatePayload) => {
      setRound(payload.round);
      setWorkers(payload.workers ?? []);
    });

    socket.on(
      "round_reset",
      (payload: { previousRound: string; newRound: string }) => {
        setRound(payload.newRound);
        setWorkers([]);
      },
    );

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => b.bestShare - a.bestShare);
  }, [workers]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-400">Bloc courant</p>
            <p className="mt-1 text-2xl font-bold">
              {roundHexToDecimal(round)}
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              connected
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {connected ? "Temps réel connecté" : "Déconnecté"}
          </div>
        </div>
      </div>

      {sortedWorkers.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
          Aucun worker visible pour le moment.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedWorkers.map((worker, index) => (
            <article
              key={`${worker.address}-${worker.workerName}`}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-400">#{index + 1}</p>
                  <h3 className="max-w-[220px] truncate text-lg font-semibold">
                    {buildDisplayName(worker.address, worker.workerName)}
                  </h3>
                </div>

                <div className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                  {worker.sharesCount} shares
                </div>
              </div>

              <div className="mb-6 flex min-h-[180px] items-end justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                <div
                  className="flex items-center justify-center rounded-full bg-orange-500 font-bold text-black transition-all duration-300"
                  style={{
                    width: `${48 * worker.size}px`,
                    height: `${48 * worker.size}px`,
                  }}
                  title={`${buildDisplayName(worker.address, worker.workerName)} — ${Math.round(worker.bestShare)}`}
                >
                  ⛏️
                </div>
              </div>

              <div className="space-y-1 text-sm text-neutral-300">
                <p>
                  Best share{" "}
                  <span className="font-semibold text-white">
                    {Math.round(worker.bestShare).toLocaleString("fr-FR")}
                  </span>
                </p>

                <p>
                  Adresse <span className="text-neutral-400">{worker.address}</span>
                </p>

                <p>
                  Worker{" "}
                  <span className="text-neutral-400">{worker.workerName}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}