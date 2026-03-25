"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type WorkerState = {
  workerName: string;
  displayName: string;
  bestSdiff: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};

type LiveStatePayload = {
  type?: "live_state";
  round: string | null;
  workers: WorkerState[];
};

let socket: Socket | null = null;

export function LiveArena() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerState[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const httpUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL;
      const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;

      if (!httpUrl || !wsUrl) {
        console.error("Variables NEXT_PUBLIC_BACKEND_HTTP_URL / WS_URL manquantes");
        return;
      }

      try {
        const res = await fetch(`${httpUrl}/live`, { cache: "no-store" });
        if (res.ok) {
          const data: LiveStatePayload = await res.json();
          setRound(data.round);
          setWorkers(data.workers ?? []);
        }
      } catch (error) {
        console.error("Erreur chargement état initial", error);
      }

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

      socket.on("round_reset", (payload: { newRound: string }) => {
        setRound(payload.newRound);
        setWorkers([]);
      });
    }

    bootstrap();

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  const sortedWorkers = useMemo(
    () => [...workers].sort((a, b) => b.bestSdiff - a.bestSdiff),
    [workers],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-400">Round courant</p>
            <p className="mt-1 text-xl font-semibold">{round ?? "Aucun"}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedWorkers.map((worker) => (
          <div
            key={worker.workerName}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="mb-4 flex min-h-[170px] items-end justify-center">
              <div
                className="flex items-center justify-center rounded-full bg-orange-500 font-bold text-black transition-all duration-300"
                style={{
                  width: `${48 * worker.size}px`,
                  height: `${48 * worker.size}px`,
                }}
              >
                ⛏️
              </div>
            </div>

            <p className="truncate font-semibold">{worker.displayName}</p>
            <p className="text-sm text-neutral-400">
              Best share: {Math.round(worker.bestSdiff)}
            </p>
            <p className="text-sm text-neutral-400">
              Shares: {worker.sharesCount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}