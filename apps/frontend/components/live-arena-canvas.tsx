"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type LiveWorkerState = {
  address: string;
  workerName: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;

  // 🔥 AJOUT
  uniqueKey: string;
};

type LiveStatePayload = {
  type?: "live_state";
  round: string | null;
  workers: LiveWorkerState[];
};

type Direction = "up" | "down" | "left" | "right";

type ArenaWorker = LiveWorkerState & {
  x: number;
  y: number;
  angle: number;
  speed: number;
  direction: Direction;
  frame: number;
  frameTimer: number;
};

let socket: Socket | null = null;

const SPRITE_SHEET_SRC = "/sprites/topdown-walkers.png";

/**
 * Ton sheet :
 * - 4 colonnes = frames
 * - 4 lignes = directions
 */
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const FRAME_COUNT = 4;

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

function directionToRow(direction: Direction): number {
  switch (direction) {
    case "up":
      return 0;
    case "down":
      return 1;
    case "left":
      return 2;
    case "right":
      return 3;
    default:
      return 1;
  }
}

function getWorkerScreenSize(size: number) {
  return clamp(36 + size * 8, 36, 56);
}

function getWorkerBaseSpeed(worker: LiveWorkerState, index: number) {
  const hash = hashString(`${worker.address}-${worker.workerName}-${index}`);
  return 22 + (hash % 18); // px/s, volontairement lent
}

function buildArenaWorkers(workers: LiveWorkerState[]): ArenaWorker[] {
  return workers.map((worker, index) => {
    const hash = hashString(`${worker.workerName}-${worker.address}-${index}`);
    const angle = (hash % 360) * (Math.PI / 180);

    return {
      ...worker,
      x: 50 + (hash % 900),
      y: 50 + ((hash >> 3) % 360),
      angle,
      speed: getWorkerBaseSpeed(worker, index),
      direction: "down",
      frame: hash % FRAME_COUNT,
      frameTimer: 0,
    };
  });
}

export function LiveArenaCanvas() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<ArenaWorker[]>([]);
  const [connected, setConnected] = useState(false);
  const [hoveredWorker, setHoveredWorker] = useState<ArenaWorker | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = SPRITE_SHEET_SRC;
    img.onload = () => {
      spriteRef.current = img;
      drawScene(workers);
    };
  }, []);

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

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

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
            const baseSpeed = getWorkerBaseSpeed(worker, index);
            const bonusSpeed = clamp(worker.bestShare / 500000000, 0, 18);

            return {
              ...existing,
              ...worker,
              speed: baseSpeed + bonusSpeed,
            };
          }

          const generated = buildArenaWorkers([worker])[0];
          return {
            ...generated,
            x: 70 + ((index * 90) % 850),
            y: 70 + ((index * 60) % 320),
          };
        });
      });
    });

    socket.on("round_reset", (payload: { previousRound: string; newRound: string }) => {
      setRound(payload.newRound);
      setWorkers([]);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  useEffect(() => {
    function tick(now: number) {
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }

      const dt = Math.min((now - lastTickRef.current) / 1000, 0.05);
      lastTickRef.current = now;

      setWorkers((current) => {
        const arenaWidth = wrapperRef.current?.clientWidth ?? 1100;
        const arenaHeight = wrapperRef.current?.clientHeight ?? 520;

        return current.map((worker, index) => {
          const spriteSize = getWorkerScreenSize(worker.size);

          let angle = worker.angle;
          let x = worker.x + Math.cos(angle) * worker.speed * dt;
          let y = worker.y + Math.sin(angle) * worker.speed * dt;

          if (x <= 8) {
            x = 8;
            angle = Math.PI - angle;
          } else if (x >= arenaWidth - spriteSize - 8) {
            x = arenaWidth - spriteSize - 8;
            angle = Math.PI - angle;
          }

          if (y <= 8) {
            y = 8;
            angle = -angle;
          } else if (y >= arenaHeight - spriteSize - 8) {
            y = arenaHeight - spriteSize - 8;
            angle = -angle;
          }

          if (index % 7 === 0) {
            angle += 0.003;
          }

          const dx = Math.cos(angle);
          const dy = Math.sin(angle);

          let direction: Direction;
          if (Math.abs(dx) > Math.abs(dy)) {
            direction = dx >= 0 ? "right" : "left";
          } else {
            direction = dy >= 0 ? "down" : "up";
          }

          let frameTimer = worker.frameTimer + dt;
          let frame = worker.frame;

          if (frameTimer >= 0.18) {
            frame = (frame + 1) % FRAME_COUNT;
            frameTimer = 0;
          }

          return {
            ...worker,
            x,
            y,
            angle,
            direction,
            frame,
            frameTimer,
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

  useEffect(() => {
    drawScene(workers);
  }, [workers]);

  function drawScene(currentWorkers: ArenaWorker[]) {
    const canvas = canvasRef.current;
    const sprite = spriteRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth || 1100;
    const height = canvas.clientHeight || 520;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0a0a0a");
    gradient.addColorStop(1, "#171717");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!sprite) return;

    currentWorkers.forEach((worker) => {
      const size = getWorkerScreenSize(worker.size);
      const row = directionToRow(worker.direction);
      const sx = worker.frame * FRAME_WIDTH;
      const sy = row * FRAME_HEIGHT;

      ctx.drawImage(
        sprite,
        sx,
        sy,
        FRAME_WIDTH,
        FRAME_HEIGHT,
        worker.x,
        worker.y,
        size,
        size,
      );
    });
  }

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
            ref={wrapperRef}
            className="relative h-[520px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;

              let found: ArenaWorker | null = null;

              for (let i = workers.length - 1; i >= 0; i -= 1) {
                const worker = workers[i];
                const size = getWorkerScreenSize(worker.size);

                if (
                  mouseX >= worker.x &&
                  mouseX <= worker.x + size &&
                  mouseY >= worker.y &&
                  mouseY <= worker.y + size
                ) {
                  found = worker;
                  break;
                }
              }

              setHoveredWorker(found);
            }}
            onMouseLeave={() => setHoveredWorker(null)}
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

            {workers.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                Aucun worker visible pour le moment.
              </div>
            ) : null}

            {workers.map((worker) => (
              <div
                key={worker.uniqueKey}
                className="pointer-events-none absolute"
                style={{
                  left: worker.x - 24,
                  top: worker.y - 18,
                  width: 120,
                }}
              >
                <div
                  className="truncate rounded-md bg-black/60 px-2 py-1 text-center text-xs font-medium text-white"
                  title={worker.displayName}
                >
                  {worker.displayName}
                </div>
              </div>
            ))}

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