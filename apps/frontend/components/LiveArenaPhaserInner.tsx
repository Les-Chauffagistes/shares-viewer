"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Phaser from "phaser";

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

type ArenaWorkerData = LiveWorkerState & {
  direction: "up" | "down" | "left" | "right";
};

type HoveredWorker = LiveWorkerState | null;

let socket: Socket | null = null;

const GAME_WIDTH = 1100;
const GAME_HEIGHT = 520;
const SPRITE_KEY = "workers";
const SPRITE_PATH = "/sprites/topdown-walkers.png";
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getWorkerScale(size: number) {
  return clamp(1 + size * 0.12, 1, 1.6);
}

function getWorkerSpeed(worker: LiveWorkerState, index: number) {
  const hash = hashString(`${worker.address}-${worker.workerName}-${index}`);
  const base = 18 + (hash % 12);
  const bonus = clamp(worker.bestShare / 500000000, 0, 10);
  return base + bonus;
}

function getSpawnPosition(worker: LiveWorkerState, index: number) {
  const hash = hashString(`${worker.address}-${worker.workerName}-${index}`);
  return {
    x: 50 + (hash % 980),
    y: 50 + ((hash >> 3) % 400),
  };
}

function getInitialDirection(worker: LiveWorkerState, index: number) {
  const hash = hashString(`${worker.workerName}-${worker.address}-${index}`);
  const dirs: ArenaWorkerData["direction"][] = ["down", "left", "right", "up"];
  return dirs[hash % dirs.length];
}

function buildArenaWorkers(workers: LiveWorkerState[]): ArenaWorkerData[] {
  return workers.map((worker, index) => ({
    ...worker,
    direction: getInitialDirection(worker, index),
  }));
}

type WorkerSprite = Phaser.Physics.Arcade.Sprite & {
  workerKey: string;
  workerData: ArenaWorkerData;
  label?: Phaser.GameObjects.Text;
};

type SceneWithApi = Phaser.Scene & {
  workerMap: Map<string, WorkerSprite>;
  hoveredWorkerRef?: { current: HoveredWorker };
  setHoveredWorker?: (worker: HoveredWorker) => void;
  isReady?: boolean;
  syncWorkers: (nextWorkers: ArenaWorkerData[]) => void;
};

export default function LiveArenaPhaserInner() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<ArenaWorkerData[]>([]);
  const [connected, setConnected] = useState(false);
  const [hoveredWorker, setHoveredWorker] = useState<HoveredWorker>(null);

  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<SceneWithApi | null>(null);

  useEffect(() => {
    const httpUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL;
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;

    if (!httpUrl || !wsUrl) {
      console.error("Variables backend manquantes");
      return;
    }

    async function loadInitialState() {
      try {
        const res = await fetch(`${httpUrl}/live`, { cache: "no-store" });

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
            return {
              ...existing,
              ...worker,
            };
          }

          return {
            ...worker,
            direction: getInitialDirection(worker, index),
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
    if (!gameContainerRef.current || gameRef.current) return;

    class ArenaScene extends Phaser.Scene {
      workerMap = new Map<string, WorkerSprite>();
      hoveredWorkerRef = { current: null as HoveredWorker };
      setHoveredWorker?: (worker: HoveredWorker) => void;
      lastDirectionChange = 0;
      isReady = false;

      constructor() {
        super("arena");
      }

      preload() {
        this.load.spritesheet(SPRITE_KEY, SPRITE_PATH, {
          frameWidth: FRAME_WIDTH,
          frameHeight: FRAME_HEIGHT,
        });
      }

      create() {
        this.cameras.main.setBackgroundColor("#0a0a0a");

        const g = this.add.graphics();
        g.fillGradientStyle(0x0a0a0a, 0x0a0a0a, 0x171717, 0x171717, 1);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        g.lineStyle(1, 0xffffff, 0.05);

        for (let x = 0; x < GAME_WIDTH; x += 48) {
          g.lineBetween(x, 0, x, GAME_HEIGHT);
        }

        for (let y = 0; y < GAME_HEIGHT; y += 48) {
          g.lineBetween(0, y, GAME_WIDTH, y);
        }

        this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.createAnimations();

        this.isReady = true;
      }

      createAnimations() {
        const anims = [
          { key: "walk-up", start: 0, end: 3 },
          { key: "walk-down", start: 4, end: 7 },
          { key: "walk-left", start: 8, end: 11 },
          { key: "walk-right", start: 12, end: 15 },
        ];

        anims.forEach((anim) => {
          if (!this.anims.exists(anim.key)) {
            this.anims.create({
              key: anim.key,
              frames: this.anims.generateFrameNumbers(SPRITE_KEY, {
                start: anim.start,
                end: anim.end,
              }),
              frameRate: 6,
              repeat: -1,
            });
          }
        });
      }

      syncWorkers(nextWorkers: ArenaWorkerData[]) {
        const nextKeys = new Set<string>();

        nextWorkers.forEach((worker, index) => {
          const workerKey = `${worker.address}-${worker.workerName}`;
          nextKeys.add(workerKey);

          let sprite = this.workerMap.get(workerKey);

          if (!sprite) {
            const spawn = getSpawnPosition(worker, index);

            sprite = this.physics.add.sprite(
              spawn.x,
              spawn.y,
              SPRITE_KEY,
              4,
            ) as WorkerSprite;

            sprite.workerKey = workerKey;
            sprite.workerData = worker;
            sprite.setCollideWorldBounds(true);
            sprite.setBounce(1, 1);
            sprite.setScale(getWorkerScale(worker.size));
            sprite.setInteractive({ cursor: "pointer" });

            const label = this.add.text(spawn.x, spawn.y - 24, worker.displayName, {
              fontSize: "12px",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.6)",
              padding: { left: 6, right: 6, top: 3, bottom: 3 },
            });
            label.setOrigin(0.5);

            sprite.label = label;

            const speed = getWorkerSpeed(worker, index);
            const direction = worker.direction;

            if (direction === "left") sprite.setVelocity(-speed, 0);
            if (direction === "right") sprite.setVelocity(speed, 0);
            if (direction === "up") sprite.setVelocity(0, -speed);
            if (direction === "down") sprite.setVelocity(0, speed);

            sprite.play(`walk-${direction}`);

            sprite.on("pointerover", () => {
              this.setHoveredWorker?.(sprite?.workerData ?? null);
            });

            sprite.on("pointerout", () => {
              this.setHoveredWorker?.(null);
            });

            this.workerMap.set(workerKey, sprite);
          } else {
            sprite.workerData = worker;
            sprite.setScale(getWorkerScale(worker.size));

            const speed = getWorkerSpeed(worker, index);
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            const currentVelocity = body.velocity.clone();

            if (currentVelocity.length() === 0) {
              const direction = worker.direction;
              if (direction === "left") sprite.setVelocity(-speed, 0);
              if (direction === "right") sprite.setVelocity(speed, 0);
              if (direction === "up") sprite.setVelocity(0, -speed);
              if (direction === "down") sprite.setVelocity(0, speed);
            } else {
              currentVelocity.normalize().scale(speed);
              sprite.setVelocity(currentVelocity.x, currentVelocity.y);
            }
          }

          if (sprite?.label) {
            sprite.label.setText(worker.displayName);
          }
        });

        for (const [key, sprite] of this.workerMap.entries()) {
          if (nextKeys.has(key)) continue;

          sprite.label?.destroy();
          sprite.destroy();
          this.workerMap.delete(key);
        }
      }

      update(time: number) {
        if (time - this.lastDirectionChange > 2500) {
          this.lastDirectionChange = time;

          for (const sprite of this.workerMap.values()) {
            if (Math.random() > 0.25) continue;

            const speed = getWorkerSpeed(sprite.workerData, 0);
            const dirs: ArenaWorkerData["direction"][] = [
              "up",
              "down",
              "left",
              "right",
            ];
            const direction = dirs[Math.floor(Math.random() * dirs.length)];

            sprite.workerData.direction = direction;

            if (direction === "left") sprite.setVelocity(-speed, 0);
            if (direction === "right") sprite.setVelocity(speed, 0);
            if (direction === "up") sprite.setVelocity(0, -speed);
            if (direction === "down") sprite.setVelocity(0, speed);

            sprite.play(`walk-${direction}`, true);
          }
        }

        for (const sprite of this.workerMap.values()) {
          const body = sprite.body as Phaser.Physics.Arcade.Body;
          const vx = body.velocity.x;
          const vy = body.velocity.y;

          let direction: ArenaWorkerData["direction"] = "down";

          if (Math.abs(vx) > Math.abs(vy)) {
            direction = vx >= 0 ? "right" : "left";
          } else if (Math.abs(vy) > 0) {
            direction = vy >= 0 ? "down" : "up";
          }

          if (sprite.anims.currentAnim?.key !== `walk-${direction}`) {
            sprite.play(`walk-${direction}`, true);
          }

          sprite.workerData.direction = direction;

          if (sprite.label) {
            sprite.label.setPosition(sprite.x, sprite.y - 24);
          }
        }
      }
    }

    const scene = new ArenaScene();

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: gameContainerRef.current,
      transparent: false,
      physics: {
        default: "arcade",
        arcade: {
          debug: false,
        },
      },
      scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    scene.setHoveredWorker = setHoveredWorker;
    sceneRef.current = scene as SceneWithApi;
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const trySync = () => {
      if (cancelled) return;

      const scene = sceneRef.current;
      if (!scene || !scene.isReady) {
        requestAnimationFrame(trySync);
        return;
      }

      scene.syncWorkers(workers);
    };

    trySync();

    return () => {
      cancelled = true;
    };
  }, [workers]);

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

          <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
            <div ref={gameContainerRef} className="h-[520px] w-full" />

            {workers.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                Aucun worker visible pour le moment.
              </div>
            ) : null}

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