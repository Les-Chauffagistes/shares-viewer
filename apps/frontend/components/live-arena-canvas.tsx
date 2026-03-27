"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { createAvatar } from "@dicebear/core";
import { pixelArt, adventurer } from "@dicebear/collection";

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

type ArenaWorker = LiveWorkerState & {
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
};

let socket: Socket | null = null;

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

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getSpriteSvg(workerName: string) {
  const seed = extractMinerName(workerName);
  const hash = hashString(seed);
  const useAltStyle = hash % 5 === 0;

  const avatar = createAvatar(useAltStyle ? adventurer : pixelArt, {
    seed,
    size: 96,
    radius: 12,
    backgroundColor: ["1f2937", "0f172a", "111827"],
    flip: hash % 2 === 0,
    rotate: (hash % 4) * 90,
    scale: 90 + (hash % 8),
  });

  return avatar.toString();
}

function buildArenaWorkers(workers: LiveWorkerState[]): ArenaWorker[] {
  return workers.map((worker, index) => {
    const seed = `${worker.workerName}-${worker.address}-${index}`;
    const hash = hashString(seed);

    return {
      ...worker,
      x: 60 + (hash % 900),
      y: 60 + ((hash >> 3) % 380),
      vx: 0.35 + ((hash % 100) / 200),
      facing: hash % 2 === 0 ? 1 : -1,
    };
  });
}

export function LiveArenaCanvas() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<ArenaWorker[]>([]);
  const [connected, setConnected] = useState(false);
  const [hoveredWorker, setHoveredWorker] = useState<ArenaWorker | null>(null);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

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
        setWorkers(buildArenaWorkers(data.workers ?? []));
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
      setWorkers((previous) => {
        const previousMap = new Map(
          previous.map((worker) => [`${worker.address}-${worker.workerName}`, worker]),
        );

        return (payload.workers ?? []).map((worker, index) => {
          const key = `${worker.address}-${worker.workerName}`;
          const existing = previousMap.get(key);

          if (existing) {
            return {
              ...existing,
              ...worker,
              vx: existing.vx,
              facing:
                worker.bestShare >= existing.bestShare
                  ? existing.facing
                  : existing.facing * -1 === 1
                    ? 1
                    : -1,
            };
          }

          const generated = buildArenaWorkers([worker])[0];
          return {
            ...generated,
            x: 80 + ((index * 110) % 900),
            y: 80 + ((index * 70) % 360),
          };
        });
      });
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

  useEffect(() => {
    function tick() {
      setWorkers((current) => {
        const arenaWidth = arenaRef.current?.clientWidth ?? 1100;
        const arenaHeight = arenaRef.current?.clientHeight ?? 520;

        return current.map((worker, index) => {
          const spriteSize = clamp(54 + worker.size * 14, 54, 92);
          const floorY = arenaHeight - spriteSize - 26;

          let nextX = worker.x + worker.vx * worker.facing;
          let nextY =
            floorY -
            Math.abs(Math.sin((Date.now() / 220 + index) % (Math.PI * 2))) * 8;

          let nextFacing = worker.facing;

          if (nextX <= 8) {
            nextX = 8;
            nextFacing = 1;
          }

          if (nextX >= arenaWidth - spriteSize - 8) {
            nextX = arenaWidth - spriteSize - 8;
            nextFacing = -1;
          }

          const speedBoost = clamp(worker.bestShare / 100000000, 0, 1.8);

          return {
            ...worker,
            x: nextX,
            y: clamp(nextY, 20, floorY),
            facing: nextFacing,
            vx: clamp(0.35 + speedBoost, 0.35, 2.2),
          };
        });
      });

      animationRef.current = requestAnimationFrame(tick);
    }

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const leaderboard = useMemo(() => {
    return [...workers].sort((a, b) => b.bestShare - a.bestShare).slice(0, 8);
  }, [workers]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-400">Bloc courant</p>
            <p className="mt-1 text-2xl font-bold">{roundHexToDecimal(round)}</p>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Arène des workers</h2>
              <p className="text-sm text-neutral-400">
                Survole un personnage pour voir ses infos
              </p>
            </div>

            <div className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              {workers.length} worker{workers.length > 1 ? "s" : ""}
            </div>
          </div>

          <div
            ref={arenaRef}
            className="relative h-[520px] overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900"
          >
            <div className="absolute inset-x-0 bottom-0 h-24 border-t border-neutral-800 bg-neutral-950/80" />
            <div className="absolute inset-x-0 bottom-8 h-px bg-neutral-800" />

            {workers.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                Aucun worker visible pour le moment.
              </div>
            ) : null}

            {workers.map((worker) => {
              const spriteSize = clamp(54 + worker.size * 14, 54, 92);
              const spriteSvg = getSpriteSvg(worker.workerName);

              return (
                <div
                  key={`${worker.address}-${worker.workerName}`}
                  className="absolute select-none"
                  style={{
                    left: worker.x,
                    top: worker.y,
                    width: spriteSize,
                  }}
                  onMouseEnter={() => setHoveredWorker(worker)}
                  onMouseLeave={() => {
                    setHoveredWorker((current) =>
                      current?.workerName === worker.workerName &&
                      current?.address === worker.address
                        ? null
                        : current,
                    );
                  }}
                >
                  <div
                    className="mb-1 max-w-[140px] truncate rounded-md bg-black/60 px-2 py-1 text-center text-xs font-medium text-white"
                    title={worker.displayName}
                  >
                    {worker.displayName}
                  </div>

                  <div
                    className="transition-transform duration-150"
                    style={{
                      transform: `scaleX(${worker.facing})`,
                    }}
                  >
                    <div
                      className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg"
                      style={{
                        width: spriteSize,
                        height: spriteSize,
                      }}
                      dangerouslySetInnerHTML={{ __html: spriteSvg }}
                    />
                  </div>
                </div>
              );
            })}

            {hoveredWorker ? (
              <div className="absolute right-4 top-4 w-[280px] rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
                <p className="text-sm text-neutral-400">Worker</p>
                <h3 className="truncate text-lg font-bold">
                  {hoveredWorker.displayName}
                </h3>

                <div className="mt-4 space-y-2 text-sm text-neutral-300">
                  <p>
                    Best share{" "}
                    <span className="font-semibold text-white">
                      {Math.round(hoveredWorker.bestShare).toLocaleString("fr-FR")}
                    </span>
                  </p>
                  <p>
                    Shares{" "}
                    <span className="font-semibold text-white">
                      {hoveredWorker.sharesCount}
                    </span>
                  </p>
                  <p>
                    Worker{" "}
                    <span className="text-neutral-400">
                      {extractMinerName(hoveredWorker.workerName)}
                    </span>
                  </p>
                  <p>
                    Adresse{" "}
                    <span className="break-all text-neutral-400">
                      {hoveredWorker.address}
                    </span>
                  </p>
                  <p>
                    Dernière share{" "}
                    <span className="text-neutral-400">
                      {hoveredWorker.lastShareTs
                        ? new Date(hoveredWorker.lastShareTs).toLocaleString("fr-FR")
                        : "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-xl font-bold">Classement live</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Top workers du bloc courant
          </p>

          <div className="mt-4 space-y-3">
            {leaderboard.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
                Pas encore de données.
              </div>
            ) : (
              leaderboard.map((worker, index) => (
                <div
                  key={`${worker.address}-${worker.workerName}-leaderboard`}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">#{index + 1}</p>
                      <p className="truncate font-semibold">{worker.displayName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">Best</p>
                      <p className="font-semibold text-white">
                        {Math.round(worker.bestShare).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}