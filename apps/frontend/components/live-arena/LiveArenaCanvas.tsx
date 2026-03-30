"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ArenaViewport } from "./ArenaViewport";
import { Leaderboard } from "./Leaderboard";
import { roundHexToDecimal } from "./helpers";
import { WALKER_COUNT } from "@/lib/live-arena/constants";
import { MAP_OBSTACLES } from "@/lib/live-arena/obstacles";
import {
  buildArenaWorkers,
  getMaxBestShare,
  getMinBestShare,
  getWorkerBaseSpeed,
  getWorkerRadiusFromBestShare,
} from "@/lib/live-arena/spawn";
import { loadSpriteSheets } from "@/lib/live-arena/sprites";
import { stepWorkers } from "@/lib/live-arena/simulation";
import { ArenaWorker, LiveStatePayload, LoadedSpriteSheet } from "@/lib/live-arena/types";
import { clamp } from "@/lib/live-arena/math";

let socket: Socket | null = null;

export function LiveArenaCanvas() {
  const [round, setRound] = useState<string | null>(null);
  const [workers, setWorkers] = useState<ArenaWorker[]>([]);
  const [connected, setConnected] = useState(false);
  const [hoveredWorker, setHoveredWorker] = useState<ArenaWorker | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [spriteSheets, setSpriteSheets] = useState<LoadedSpriteSheet[]>([]);

  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const spriteSheetsRef = useRef<LoadedSpriteSheet[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function bootSprites() {
      try {
        const loaded = await loadSpriteSheets(WALKER_COUNT);
        if (cancelled) return;

        spriteSheetsRef.current = loaded;
        setSpriteSheets(loaded);

        setWorkers((previous) =>
          previous.map((worker) => ({
            ...worker,
            spriteIndex:
              loaded.length > 0 ? worker.spriteIndex % loaded.length : 0,
          })),
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
        const spriteCount = Math.max(spriteSheetsRef.current.length, WALKER_COUNT, 1);

        setRound(data.round);
        setWorkers(buildArenaWorkers(data.workers ?? [], spriteCount, MAP_OBSTACLES));
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
              spriteIndex: existing.spriteIndex,
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Arène des workers</h2>
              <p className="text-sm text-neutral-400">
                Clique-glisse pour déplacer la caméra dans la map
              </p>
            </div>

            <div className="rounded-xl bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              {workerCountLabel}
            </div>
          </div>

          <ArenaViewport
            workers={workers}
            camera={camera}
            setCamera={setCamera}
            hoveredWorker={hoveredWorker}
            setHoveredWorker={setHoveredWorker}
            spriteSheets={spriteSheets}
          />
        </div>

        <Leaderboard workers={workers} />
      </div>
    </section>
  );
}