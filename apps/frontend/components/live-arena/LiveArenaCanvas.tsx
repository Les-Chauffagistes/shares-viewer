"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ArenaViewport } from "./ArenaViewport";
import { Leaderboard } from "./Leaderboard";
import { roundHexToDecimal } from "./helpers";
import {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WALKER_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/lib/live-arena/constants";
import { MAP_OBSTACLES } from "@/lib/live-arena/obstacles";
import {
  buildArenaWorkers,
  getMaxBestShare,
  getMinBestShare,
  getWorkerBaseSpeed,
  getWorkerRadiusFromBestShare,
  getWorkerScreenSize,
} from "@/lib/live-arena/spawn";
import {
  getSafeWalkerIndexForLevel,
  loadSpriteSheets,
} from "@/lib/live-arena/sprites";
import { stepWorkers } from "@/lib/live-arena/simulation";
import {
  ArenaWorker,
  LiveStatePayload,
  LoadedSpriteSheet,
} from "@/lib/live-arena/types";
import { clamp } from "@/lib/live-arena/math";

let socket: Socket | null = null;

export function LiveArenaCanvas() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<ArenaWorker[]>([]);
  const [connected, setConnected] = useState(false);
  const [hoveredWorker, setHoveredWorker] = useState<ArenaWorker | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [spriteSheets, setSpriteSheets] = useState<LoadedSpriteSheet[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [focusedWorkerKey, setFocusedWorkerKey] = useState<string | null>(null);

  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const spriteSheetsRef = useRef<LoadedSpriteSheet[]>([]);
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootSprites() {
      try {
        const loaded = await loadSpriteSheets();
        if (cancelled) return;

        spriteSheetsRef.current = loaded;
        setSpriteSheets(loaded);

        setWorkers((previous) =>
          previous.map((worker) => {
            const level = worker.level ?? 1;

            return {
              ...worker,
              spriteIndex: getSafeWalkerIndexForLevel(level, loaded.length),
            };
          }),
        );
      } catch (error) {
        console.error(error);
      }
    }

    bootSprites();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === arenaContainerRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      const container = arenaContainerRef.current;
      if (!container) return;

      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error("Impossible de basculer en plein écran", error);
    }
  }

  useEffect(() => {
    const httpUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL;
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;

    if (!httpUrl || !wsUrl) {
      console.error("Variables backend manquantes");
      return;
    }

    async function loadInitialState() {
      try {
        const res = await fetch(`${httpUrl}/api/live`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Impossible de charger /live");
        }

        const data: LiveStatePayload = await res.json();
        const spriteCount = Math.max(
          spriteSheetsRef.current.length,
          WALKER_COUNT,
          1,
        );

        setRound(data.round);

        const builtWorkers = buildArenaWorkers(
          data.workers ?? [],
          spriteCount,
          MAP_OBSTACLES,
        );

        setWorkers(
          builtWorkers.map((worker) => ({
            ...worker,
            spriteIndex: getSafeWalkerIndexForLevel(
              worker.level ?? 1,
              spriteSheetsRef.current.length,
            ),
          })),
        );
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
          previous.map((worker) => [worker.uniqueKey, worker]),
        );

        const spriteCount = Math.max(
          spriteSheetsRef.current.length,
          WALKER_COUNT,
          1,
        );

        const incomingWorkers = payload.workers ?? [];
        const minBestShare = getMinBestShare(incomingWorkers);
        const maxBestShare = getMaxBestShare(incomingWorkers);

        return incomingWorkers.map((worker, index) => {
          const existing = previousMap.get(worker.uniqueKey);

          if (existing) {
            const baseSpeed = getWorkerBaseSpeed(worker, index);
            const bonusSpeed = clamp(worker.bestShare / 500000000, 0, 18);

            return {
              ...existing,
              ...worker,
              speed: baseSpeed + bonusSpeed,
              radius: getWorkerRadiusFromBestShare(
                worker.bestShare,
                minBestShare,
                maxBestShare,
              ),
              spriteIndex: getSafeWalkerIndexForLevel(
                worker.level ?? 1,
                spriteSheetsRef.current.length,
              ),
            };
          }

          const generated = buildArenaWorkers(
            [worker],
            spriteCount,
            MAP_OBSTACLES,
          )[0];

          return {
            ...generated,
            radius: getWorkerRadiusFromBestShare(
              worker.bestShare,
              minBestShare,
              maxBestShare,
            ),
            spriteIndex: getSafeWalkerIndexForLevel(
              worker.level ?? 1,
              spriteSheetsRef.current.length,
            ),
          };
        });
      });
    });

    socket.on(
      "round_reset",
      (payload: { previousRound: string; newRound: string }) => {
        setRound(payload.newRound);
        setWorkers([]);
        setFocusedWorkerKey(null);
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
    function tick(now: number) {
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }

      const dt = Math.min((now - lastTickRef.current) / 1000, 0.05);
      lastTickRef.current = now;

      setWorkers((current) => stepWorkers(current, dt, now, MAP_OBSTACLES));
      animationRef.current = requestAnimationFrame(tick);
    }

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const workerCountLabel = useMemo(
    () => `${workers.length} worker${workers.length > 1 ? "s" : ""}`,
    [workers],
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return workers.filter((worker) => {
      return (
        worker.address.toLowerCase().includes(q) ||
        worker.workerName.toLowerCase().includes(q) ||
        worker.displayName.toLowerCase().includes(q)
      );
    });
  }, [workers, searchQuery]);

  const focusedWorker = useMemo(() => {
    if (focusedWorkerKey) {
      return workers.find((worker) => worker.uniqueKey === focusedWorkerKey) ?? null;
    }

    if (searchResults.length > 0) {
      return searchResults[0];
    }

    return null;
  }, [workers, focusedWorkerKey, searchResults]);

  function centerCameraOnWorker(worker: ArenaWorker) {
    const viewportWidth =
      arenaContainerRef.current?.clientWidth ?? VIEWPORT_WIDTH;
    const viewportHeight =
      arenaContainerRef.current?.clientHeight ?? VIEWPORT_HEIGHT;

    const workerSize = getWorkerScreenSize(
      worker.bestShare,
      getMinBestShare(workers),
      getMaxBestShare(workers),
    );

    const nextX = clamp(
      worker.x - viewportWidth / 2 + workerSize / 2,
      0,
      Math.max(0, WORLD_WIDTH - viewportWidth),
    );

    const nextY = clamp(
      worker.y - viewportHeight / 2 + workerSize / 2,
      0,
      Math.max(0, WORLD_HEIGHT - viewportHeight),
    );

    setCamera({
      x: nextX,
      y: nextY,
    });

    setFocusedWorkerKey(worker.uniqueKey);
    setHoveredWorker(worker);
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFocusedWorkerKey(null);
      return;
    }

    if (searchResults.length > 0) {
      const target = searchResults[0];
      setFocusedWorkerKey(target.uniqueKey);
      centerCameraOnWorker(target);
    }
  }, [searchQuery, searchResults.length]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-400">Bloc courant</p>
            <p className="mt-1 text-2xl font-bold">{roundHexToDecimal(round)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              Map 2600 × 1800
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedWorkerKey(null);
            }}
            placeholder="Chercher une adresse ou un worker..."
            className="min-w-[280px] flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-500"
          />

          <button
            type="button"
            onClick={() => {
              if (searchResults.length > 0) {
                centerCameraOnWorker(searchResults[0]);
              }
            }}
            disabled={searchResults.length === 0}
            className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Centrer
          </button>

          {searchQuery.trim() ? (
            <div className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              {searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}
            </div>
          ) : null}
        </div>

        {searchQuery.trim() && searchResults.length > 0 ? (
          <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {searchResults.slice(0, 8).map((worker) => (
              <button
                key={worker.uniqueKey}
                type="button"
                onClick={() => centerCameraOnWorker(worker)}
                className={`rounded-lg px-3 py-2 text-left text-xs transition ${
                  focusedWorker?.uniqueKey === worker.uniqueKey
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-neutral-950 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <div className="font-medium">{worker.displayName}</div>
                <div className="text-neutral-400">{worker.address}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div
          ref={arenaContainerRef}
          className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 ${
            isFullscreen ? "h-screen w-screen rounded-none border-0" : ""
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Ville des workers</h2>
              <p className="text-sm text-neutral-400">
                Clique-glisse pour déplacer la caméra dans la map
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800"
              >
                {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              </button>

              <div className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
                {workerCountLabel}
              </div>
            </div>
          </div>

          <ArenaViewport
            workers={workers}
            camera={camera}
            setCamera={setCamera}
            hoveredWorker={hoveredWorker}
            setHoveredWorker={setHoveredWorker}
            spriteSheets={spriteSheets}
            isFullscreen={isFullscreen}
            focusedWorkerKey={focusedWorker?.uniqueKey ?? null}
          />
        </div>

        {!isFullscreen ? <Leaderboard workers={workers} /> : null}
      </div>
    </section>
  );
}