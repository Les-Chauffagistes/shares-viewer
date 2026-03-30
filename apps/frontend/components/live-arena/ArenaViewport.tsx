"use client";

import { useEffect, useRef } from "react";
import {
  CAMERA_DRAG_BUTTON,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/lib/live-arena/constants";
import { clamp } from "@/lib/live-arena/math";
import { MAP_OBSTACLES } from "@/lib/live-arena/obstacles";
import { directionToRow } from "@/lib/live-arena/sprites";
import {
  getMaxBestShare,
  getMinBestShare,
  getWorkerScreenSize,
} from "@/lib/live-arena/spawn";
import { ArenaWorker, LoadedSpriteSheet } from "@/lib/live-arena/types";
import { WorkerTooltip } from "./WorkerTooltip";

type Camera = { x: number; y: number };

type Props = {
  workers: ArenaWorker[];
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  hoveredWorker: ArenaWorker | null;
  setHoveredWorker: React.Dispatch<React.SetStateAction<ArenaWorker | null>>;
  spriteSheets: LoadedSpriteSheet[];
};

export function ArenaViewport({
  workers,
  camera,
  setCamera,
  hoveredWorker,
  setHoveredWorker,
  spriteSheets,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dragStateRef = useRef<{
    active: boolean;
    startMouseX: number;
    startMouseY: number;
    startCameraX: number;
    startCameraY: number;
  }>({
    active: false,
    startMouseX: 0,
    startMouseY: 0,
    startCameraX: 0,
    startCameraY: 0,
  });

  useEffect(() => {
    drawScene();
  }, [workers, camera, spriteSheets]);

  function screenToWorld(clientX: number, clientY: number) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: clientX, y: clientY };
    }

    return {
      x: clientX - rect.left + camera.x,
      y: clientY - rect.top + camera.y,
    };
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawRoads(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#7d7d72";
    ctx.fillRect(0, 540, WORLD_WIDTH, 120);
    ctx.fillRect(980, 0, 140, WORLD_HEIGHT);
    ctx.fillRect(1650, 0, 110, WORLD_HEIGHT);

    ctx.fillStyle = "#c5b991";
    ctx.fillRect(820, 930, 760, 52);
    ctx.fillRect(1180, 520, 52, 620);
    ctx.fillRect(920, 700, 560, 44);
  }

  function drawObstacles(ctx: CanvasRenderingContext2D) {
    for (const obstacle of MAP_OBSTACLES) {
      switch (obstacle.kind) {
        case "building":
          ctx.fillStyle = obstacle.color || "#6a4c3c";
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.fillStyle = "#3d2b20";
          ctx.fillRect(obstacle.x + 18, obstacle.y + 18, obstacle.width - 36, 18);
          ctx.fillStyle = "#9bb6c7";
          for (let wy = obstacle.y + 45; wy < obstacle.y + obstacle.height - 28; wy += 42) {
            for (let wx = obstacle.x + 22; wx < obstacle.x + obstacle.width - 32; wx += 46) {
              ctx.fillRect(wx, wy, 20, 20);
            }
          }
          break;

        case "lake":
          ctx.fillStyle = obstacle.color || "#2b6f95";
          roundRect(ctx, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 28, true, false);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          roundRect(ctx, obstacle.x + 18, obstacle.y + 16, obstacle.width - 36, 24, 12, true, false);
          break;

        case "tree":
          ctx.fillStyle = "#6d442b";
          ctx.fillRect(
            obstacle.x + obstacle.width / 2 - 6,
            obstacle.y + obstacle.height - 14,
            12,
            14,
          );
          ctx.fillStyle = obstacle.color || "#2f7d32";
          ctx.beginPath();
          ctx.arc(
            obstacle.x + obstacle.width / 2,
            obstacle.y + obstacle.height / 2,
            obstacle.width / 2.1,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          break;

        case "bench":
          ctx.fillStyle = obstacle.color || "#7a522e";
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.fillStyle = "#4a3018";
          ctx.fillRect(obstacle.x + 8, obstacle.y + obstacle.height - 6, 6, 12);
          ctx.fillRect(
            obstacle.x + obstacle.width - 14,
            obstacle.y + obstacle.height - 6,
            6,
            12,
          );
          break;

        case "statue":
          ctx.fillStyle = "#8f8f8f";
          ctx.fillRect(obstacle.x + 18, obstacle.y + 10, 24, 38);
          ctx.fillStyle = "#6f6f6f";
          ctx.fillRect(obstacle.x + 10, obstacle.y + 46, 40, 12);
          break;
      }
    }
  }

  function drawMiniHud(
    ctx: CanvasRenderingContext2D,
    visibleWorkersCount: number,
    camX: number,
    camY: number,
  ) {
    const mapW = 180;
    const mapH = 120;
    const x = VIEWPORT_WIDTH - mapW - 12;
    const y = VIEWPORT_HEIGHT - mapH - 12;

    ctx.fillStyle = "rgba(10,10,10,0.8)";
    roundRect(ctx, x, y, mapW, mapH, 12, true, false);

    ctx.fillStyle = "#264d2c";
    roundRect(ctx, x + 8, y + 8, mapW - 16, mapH - 16, 8, true, false);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x + 8, y + 8, mapW - 16, mapH - 16);

    const camRectX = x + 8 + (camX / WORLD_WIDTH) * (mapW - 16);
    const camRectY = y + 8 + (camY / WORLD_HEIGHT) * (mapH - 16);
    const camRectW = (VIEWPORT_WIDTH / WORLD_WIDTH) * (mapW - 16);
    const camRectH = (VIEWPORT_HEIGHT / WORLD_HEIGHT) * (mapH - 16);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(camRectX, camRectY, camRectW, camRectH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${visibleWorkersCount} workers`, x + 12, y + 18);
  }

  function drawScene() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const width = canvas.clientWidth || VIEWPORT_WIDTH;
    const height = canvas.clientHeight || VIEWPORT_HEIGHT;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0b1510");
    gradient.addColorStop(1, "#112019");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const camX = camera.x;
    const camY = camera.y;

    ctx.save();
    ctx.translate(-camX, -camY);

    ctx.fillStyle = "#264d2c";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    drawRoads(ctx);
    drawObstacles(ctx);

    if (spriteSheets.length > 0) {
      workers.forEach((worker) => {
        const screenX = worker.x - camX;
        const screenY = worker.y - camY;
        const size = getWorkerScreenSize(
          worker.bestShare,
          minBestShare,
          maxBestShare,
        );

        if (
          screenX + size < -80 ||
          screenY + size < -80 ||
          screenX > width + 80 ||
          screenY > height + 80
        ) {
          return;
        }

        const sheet =
          spriteSheets[worker.spriteIndex % spriteSheets.length] ?? spriteSheets[0];

        if (!sheet) return;

        const row = directionToRow(worker.direction);
        const sx = worker.frame * sheet.frameWidth;
        const sy = row * sheet.frameHeight;

        ctx.drawImage(
          sheet.image,
          sx,
          sy,
          sheet.frameWidth,
          sheet.frameHeight,
          Math.round(worker.x - size / 2),
          Math.round(worker.y - size / 2),
          size,
          size,
        );
      });
    }

    ctx.restore();
    drawMiniHud(ctx, workers.length, camX, camY);
  }

  const minBestShare = getMinBestShare(workers);
  const maxBestShare = getMaxBestShare(workers);

  return (
    <div
      ref={wrapperRef}
      className="relative h-[520px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 select-none"
      onMouseDown={(e) => {
        if (e.button !== CAMERA_DRAG_BUTTON) return;

        dragStateRef.current = {
          active: true,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startCameraX: camera.x,
          startCameraY: camera.y,
        };
      }}
      onMouseUp={() => {
        dragStateRef.current.active = false;
      }}
      onMouseLeave={() => {
        dragStateRef.current.active = false;
        setHoveredWorker(null);
      }}
      onMouseMove={(e) => {
        const drag = dragStateRef.current;

        if (drag.active) {
          const dx = e.clientX - drag.startMouseX;
          const dy = e.clientY - drag.startMouseY;

          setCamera({
            x: clamp(drag.startCameraX - dx, 0, Math.max(0, WORLD_WIDTH - VIEWPORT_WIDTH)),
            y: clamp(drag.startCameraY - dy, 0, Math.max(0, WORLD_HEIGHT - VIEWPORT_HEIGHT)),
          });

          return;
        }

        const world = screenToWorld(e.clientX, e.clientY);

        let found: ArenaWorker | null = null;

        for (let i = workers.length - 1; i >= 0; i -= 1) {
          const worker = workers[i];
          const size = getWorkerScreenSize(
            worker.bestShare,
            minBestShare,
            maxBestShare,
          );
          const left = worker.x - size / 2;
          const top = worker.y - size / 2;

          if (
            world.x >= left &&
            world.x <= left + size &&
            world.y >= top &&
            world.y <= top + size
          ) {
            found = worker;
            break;
          }
        }

        setHoveredWorker(found);
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing [image-rendering:pixelated]"
      />

      {workers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
          Aucun worker visible pour le moment.
        </div>
      ) : null}

      {workers.map((worker) => {
        const size = getWorkerScreenSize(
          worker.bestShare,
          minBestShare,
          maxBestShare,
        );
        const screenX = worker.x - camera.x;
        const screenY = worker.y - camera.y;
        const level = worker.level ?? 1;

        if (
          screenX + size < -80 ||
          screenY + size < -80 ||
          screenX > VIEWPORT_WIDTH + 80 ||
          screenY > VIEWPORT_HEIGHT + 80
        ) {
          return null;
        }

        return (
          <div
            key={worker.uniqueKey}
            className="pointer-events-none absolute"
            style={{
              left: screenX - 90,
              top: screenY - size / 2 - 24,
              width: 180,
            }}
          >
            <div
              className="flex items-center justify-center gap-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white"
              title={worker.displayName}
            >
              <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-300">
                Lv.{level}
              </span>
              <span className="whitespace-nowrap">
                {worker.displayName}
              </span>
            </div>
          </div>
        );
      })}

      {hoveredWorker ? <WorkerTooltip worker={hoveredWorker} /> : null}
    </div>
  );
}