"use client";

import { useEffect, useRef, useState } from "react";
import {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/lib/live-arena/constants";
import { clamp } from "@/lib/live-arena/math";
import { MAP_OBSTACLES } from "@/lib/live-arena/obstacles";
import {
  directionToRow,
  getWalkerTitleForLevel,
} from "@/lib/live-arena/sprites";
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
  isFullscreen?: boolean;
  focusedWorkerKey?: string | null;
  selectedWorkerKey?: string | null;
  onSelectWorker?: (worker: ArenaWorker) => void;
  onClearSelection?: () => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
};

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

export function ArenaViewport({
  workers,
  camera,
  setCamera,
  hoveredWorker,
  setHoveredWorker,
  spriteSheets,
  isFullscreen = false,
  focusedWorkerKey = null,
  selectedWorkerKey = null,
  onSelectWorker,
  onClearSelection,
  zoom,
  setZoom,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bitcoinLogoRef = useRef<HTMLImageElement | null>(null);
  const chauffagistesLogoRef = useRef<HTMLImageElement | null>(null);

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const interactionRef = useRef<{
    mode: "none" | "pan" | "pinch";
    pointers: Map<number, { x: number; y: number }>;
    startCameraX: number;
    startCameraY: number;
    startPointerX: number;
    startPointerY: number;
    startZoom: number;
    startDistance: number;
    pinchWorldCenterX: number;
    pinchWorldCenterY: number;
    moved: boolean;
  }>({
    mode: "none",
    pointers: new Map(),
    startCameraX: 0,
    startCameraY: 0,
    startPointerX: 0,
    startPointerY: 0,
    startZoom: 1,
    startDistance: 0,
    pinchWorldCenterX: 0,
    pinchWorldCenterY: 0,
    moved: false,
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");

    const update = () => setIsSmallScreen(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const bitcoinImg = new Image();
    bitcoinImg.src = "/logos/bitcoin.png";
    bitcoinLogoRef.current = bitcoinImg;

    const chauffagistesImg = new Image();
    chauffagistesImg.src = "/logos/chauffagistes.webp";
    chauffagistesLogoRef.current = chauffagistesImg;

    const redraw = () => drawScene();

    bitcoinImg.onload = redraw;
    chauffagistesImg.onload = redraw;
  }, []);

  useEffect(() => {
    drawScene();
  }, [workers, camera, spriteSheets, isFullscreen, focusedWorkerKey, zoom]);

  function getViewportSize() {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      };
    }

    return {
      width: wrapper.clientWidth || VIEWPORT_WIDTH,
      height: wrapper.clientHeight || VIEWPORT_HEIGHT,
    };
  }

  function getVisibleWorldSize(currentZoom = zoom) {
    const { width, height } = getViewportSize();

    return {
      visibleWorldWidth: width / currentZoom,
      visibleWorldHeight: height / currentZoom,
    };
  }

  function clampCamera(nextX: number, nextY: number, currentZoom = zoom) {
    const { visibleWorldWidth, visibleWorldHeight } =
      getVisibleWorldSize(currentZoom);

    return {
      x: clamp(nextX, 0, Math.max(0, WORLD_WIDTH - visibleWorldWidth)),
      y: clamp(nextY, 0, Math.max(0, WORLD_HEIGHT - visibleWorldHeight)),
    };
  }

  function screenToWorld(clientX: number, clientY: number, currentZoom = zoom) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: clientX, y: clientY };
    }

    return {
      x: camera.x + (clientX - rect.left) / currentZoom,
      y: camera.y + (clientY - rect.top) / currentZoom,
    };
  }

  function screenToWorldFromCamera(
    clientX: number,
    clientY: number,
    camX: number,
    camY: number,
    currentZoom: number,
  ) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: clientX, y: clientY };
    }

    return {
      x: camX + (clientX - rect.left) / currentZoom,
      y: camY + (clientY - rect.top) / currentZoom,
    };
  }

  function zoomAtPoint(
    nextZoomRaw: number,
    clientX: number,
    clientY: number,
    baseCamera = camera,
    baseZoom = zoom,
  ) {
    const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === baseZoom) return;

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    const worldX = baseCamera.x + offsetX / baseZoom;
    const worldY = baseCamera.y + offsetY / baseZoom;

    const nextCameraX = worldX - offsetX / nextZoom;
    const nextCameraY = worldY - offsetY / nextZoom;
    const clamped = clampCamera(nextCameraX, nextCameraY, nextZoom);

    setZoom(nextZoom);
    setCamera(clamped);
  }

  function getDistance(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function getMidpoint(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
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
          for (
            let wy = obstacle.y + 45;
            wy < obstacle.y + obstacle.height - 28;
            wy += 42
          ) {
            for (
              let wx = obstacle.x + 22;
              wx < obstacle.x + obstacle.width - 32;
              wx += 46
            ) {
              ctx.fillRect(wx, wy, 20, 20);
            }
          }
          break;

        case "lake":
          ctx.fillStyle = obstacle.color || "#2b6f95";
          roundRect(
            ctx,
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height,
            28,
            true,
            false,
          );
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          roundRect(
            ctx,
            obstacle.x + 18,
            obstacle.y + 16,
            obstacle.width - 36,
            24,
            12,
            true,
            false,
          );
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

        case "plaza":
          ctx.fillStyle = obstacle.color || "#b9a27f";
          roundRect(
            ctx,
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height,
            18,
            true,
            false,
          );

          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 2;
          roundRect(
            ctx,
            obstacle.x + 6,
            obstacle.y + 6,
            obstacle.width - 12,
            obstacle.height - 12,
            14,
            false,
            true,
          );
          break;

        case "logo": {
          let image: HTMLImageElement | null = null;

          if (obstacle.id === "btc_logo_zone") {
            image = bitcoinLogoRef.current;
          } else if (obstacle.id === "chauffagistes_logo_zone") {
            image = chauffagistesLogoRef.current;
          }

          ctx.fillStyle = obstacle.color || "#ffffff";
          roundRect(
            ctx,
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height,
            12,
            true,
            false,
          );

          if (image && image.complete) {
            ctx.drawImage(
              image,
              obstacle.x,
              obstacle.y,
              obstacle.width,
              obstacle.height,
            );
          } else {
            ctx.fillStyle = "#111111";
            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              obstacle.id === "btc_logo_zone" ? "₿" : "LC",
              obstacle.x + obstacle.width / 2,
              obstacle.y + obstacle.height / 2,
            );
          }

          break;
        }
      }
    }
  }

  function drawMiniHud(
    ctx: CanvasRenderingContext2D,
    visibleWorkersCount: number,
    camX: number,
    camY: number,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    const isSmall = viewportWidth < 640;
    const mapW = isSmall ? 132 : 180;
    const mapH = isSmall ? 88 : 120;
    const x = viewportWidth - mapW - 12;
    const y = viewportHeight - mapH - 12;

    ctx.fillStyle = "rgba(10,10,10,0.8)";
    roundRect(ctx, x, y, mapW, mapH, 12, true, false);

    ctx.fillStyle = "#264d2c";
    roundRect(ctx, x + 8, y + 8, mapW - 16, mapH - 16, 8, true, false);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x + 8, y + 8, mapW - 16, mapH - 16);

    const { visibleWorldWidth, visibleWorldHeight } = getVisibleWorldSize();

    const camRectX = x + 8 + (camX / WORLD_WIDTH) * (mapW - 16);
    const camRectY = y + 8 + (camY / WORLD_HEIGHT) * (mapH - 16);
    const camRectW = (visibleWorldWidth / WORLD_WIDTH) * (mapW - 16);
    const camRectH = (visibleWorldHeight / WORLD_HEIGHT) * (mapH - 16);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(camRectX, camRectY, camRectW, camRectH);

    ctx.fillStyle = "#ffffff";
    ctx.font = isSmall ? "10px sans-serif" : "12px sans-serif";
    ctx.fillText(`${visibleWorkersCount} workers`, x + 12, y + 18);
    ctx.fillText(`x${zoom.toFixed(2)}`, x + 12, y + (isSmall ? 32 : 36));
  }

  function drawScene() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const { width, height } = getViewportSize();

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
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.fillStyle = "#264d2c";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1 / zoom;

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
        const screenX = (worker.x - camX) * zoom;
        const screenY = (worker.y - camY) * zoom;

        const size = getWorkerScreenSize(
          worker.bestShare,
          minBestShare,
          maxBestShare,
        );

        const scaledSize = size * zoom;

        if (
          screenX + scaledSize < -80 ||
          screenY + scaledSize < -80 ||
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

        if (
          focusedWorkerKey === worker.uniqueKey ||
          selectedWorkerKey === worker.uniqueKey
        ) {
          ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
          ctx.lineWidth = 3 / zoom;
          ctx.beginPath();
          ctx.arc(worker.x, worker.y, size / 2 + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    ctx.restore();
    drawMiniHud(ctx, workers.length, camX, camY, width, height);
  }

  const minBestShare = getMinBestShare(workers);
  const maxBestShare = getMaxBestShare(workers);

  function getWorkerAtPoint(clientX: number, clientY: number) {
    const { width, height } = getViewportSize();
    const world = screenToWorld(clientX, clientY);

    for (let i = workers.length - 1; i >= 0; i -= 1) {
      const worker = workers[i];
      const size = getWorkerScreenSize(
        worker.bestShare,
        minBestShare,
        maxBestShare,
      );
      const left = worker.x - size / 2;
      const top = worker.y - size / 2;

      const screenX = (worker.x - camera.x) * zoom;
      const screenY = (worker.y - camera.y) * zoom;
      const scaledSize = size * zoom;

      if (
        screenX + scaledSize < -80 ||
        screenY + scaledSize < -80 ||
        screenX > width + 80 ||
        screenY > height + 80
      ) {
        continue;
      }

      if (
        world.x >= left &&
        world.x <= left + size &&
        world.y >= top &&
        world.y <= top + size
      ) {
        return worker;
      }
    }

    return null;
  }

  function updateHoveredWorkerFromPoint(clientX: number, clientY: number) {
    if (selectedWorkerKey) {
      const selected =
        workers.find((worker) => worker.uniqueKey === selectedWorkerKey) ?? null;
      setHoveredWorker(selected);
      return;
    }

    setHoveredWorker(getWorkerAtPoint(clientX, clientY));
  }

  const viewportHeightClass = isFullscreen
    ? "h-[100vh] sm:h-[calc(100vh-110px)]"
    : "h-[360px] sm:h-[420px] lg:h-[520px]";

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 select-none touch-none ${viewportHeightClass}`}
      onPointerDown={(e) => {
        if (!wrapperRef.current) return;

        wrapperRef.current.setPointerCapture?.(e.pointerId);

        interactionRef.current.pointers.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });

        const pointers = Array.from(interactionRef.current.pointers.values());

        if (pointers.length === 1) {
          interactionRef.current.mode = "pan";
          interactionRef.current.startPointerX = e.clientX;
          interactionRef.current.startPointerY = e.clientY;
          interactionRef.current.startCameraX = camera.x;
          interactionRef.current.startCameraY = camera.y;
          interactionRef.current.moved = false;
        } else if (pointers.length === 2 && isSmallScreen) {
          const [p1, p2] = pointers;
          const midpoint = getMidpoint(p1, p2);
          const worldMid = screenToWorldFromCamera(
            midpoint.x,
            midpoint.y,
            camera.x,
            camera.y,
            zoom,
          );

          interactionRef.current.mode = "pinch";
          interactionRef.current.startZoom = zoom;
          interactionRef.current.startCameraX = camera.x;
          interactionRef.current.startCameraY = camera.y;
          interactionRef.current.startDistance = getDistance(p1, p2);
          interactionRef.current.pinchWorldCenterX = worldMid.x;
          interactionRef.current.pinchWorldCenterY = worldMid.y;
          interactionRef.current.moved = true;
        }
      }}
      onPointerMove={(e) => {
        const current = interactionRef.current.pointers.get(e.pointerId);
        if (!current) {
          updateHoveredWorkerFromPoint(e.clientX, e.clientY);
          return;
        }

        interactionRef.current.pointers.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });

        const state = interactionRef.current;
        const pointers = Array.from(state.pointers.values());

        if (state.mode === "pinch" && pointers.length >= 2 && isSmallScreen) {
          const [p1, p2] = pointers;
          const midpoint = getMidpoint(p1, p2);
          const distance = getDistance(p1, p2);

          if (state.startDistance > 0) {
            const nextZoom = clamp(
              state.startZoom * (distance / state.startDistance),
              MIN_ZOOM,
              MAX_ZOOM,
            );

            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            const offsetX = midpoint.x - rect.left;
            const offsetY = midpoint.y - rect.top;

            const nextCameraX = state.pinchWorldCenterX - offsetX / nextZoom;
            const nextCameraY = state.pinchWorldCenterY - offsetY / nextZoom;

            const clamped = clampCamera(nextCameraX, nextCameraY, nextZoom);

            setZoom(nextZoom);
            setCamera(clamped);
          }

          return;
        }

        if (state.mode === "pan" && pointers.length === 1) {
          const dx = e.clientX - state.startPointerX;
          const dy = e.clientY - state.startPointerY;

          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            state.moved = true;
          }

          const next = clampCamera(
            state.startCameraX - dx / zoom,
            state.startCameraY - dy / zoom,
            zoom,
          );

          setCamera(next);
          return;
        }

        updateHoveredWorkerFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        const state = interactionRef.current;
        const hadPointer = state.pointers.has(e.pointerId);
        const releasedPoint = state.pointers.get(e.pointerId);

        state.pointers.delete(e.pointerId);

        const pointers = Array.from(state.pointers.values());

        if (hadPointer && !state.moved && releasedPoint && pointers.length === 0) {
          const clickedWorker = getWorkerAtPoint(releasedPoint.x, releasedPoint.y);

          if (clickedWorker) {
            onSelectWorker?.(clickedWorker);
            setHoveredWorker(clickedWorker);
          } else {
            onClearSelection?.();
            setHoveredWorker(null);
          }
        }

        if (pointers.length === 0) {
          state.mode = "none";
          state.moved = false;
        } else if (pointers.length === 1) {
          const remaining = pointers[0];
          state.mode = "pan";
          state.startPointerX = remaining.x;
          state.startPointerY = remaining.y;
          state.startCameraX = camera.x;
          state.startCameraY = camera.y;
          state.moved = false;
        }
      }}
      onPointerCancel={(e) => {
        interactionRef.current.pointers.delete(e.pointerId);

        const pointers = Array.from(interactionRef.current.pointers.values());

        if (pointers.length === 0) {
          interactionRef.current.mode = "none";
          interactionRef.current.moved = false;
        }
      }}
      onPointerLeave={() => {
        if (interactionRef.current.mode === "none" && !selectedWorkerKey) {
          setHoveredWorker(null);
        }
      }}
      onWheel={(e) => {
        if (!isFullscreen || isSmallScreen) return;

        e.preventDefault();

        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        zoomAtPoint(zoom + delta, e.clientX, e.clientY);
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing [image-rendering:pixelated]"
      />

      <div
        className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-2 py-2 text-xs text-white backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            zoomAtPoint(
              zoom - ZOOM_STEP,
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
          }}
          className="rounded bg-white/10 px-2 py-1 transition hover:bg-white/20"
        >
          −
        </button>

        <span className="min-w-[52px] text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            zoomAtPoint(
              zoom + ZOOM_STEP,
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
          }}
          className="rounded bg-white/10 px-2 py-1 transition hover:bg-white/20"
        >
          +
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            zoomAtPoint(
              1,
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
          }}
          className="rounded bg-white/10 px-2 py-1 transition hover:bg-white/20"
        >
          Reset
        </button>
      </div>

      {workers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
          Aucun worker visible pour le moment.
        </div>
      ) : null}

      {workers.map((worker) => {
        const { width, height } = getViewportSize();
        const size = getWorkerScreenSize(
          worker.bestShare,
          minBestShare,
          maxBestShare,
        );

        const screenX = (worker.x - camera.x) * zoom;
        const screenY = (worker.y - camera.y) * zoom;
        const scaledSize = size * zoom;

        const level = worker.level ?? 1;
        const isHovered =
          hoveredWorker?.uniqueKey === worker.uniqueKey ||
          selectedWorkerKey === worker.uniqueKey;

        if (
          screenX + scaledSize < -80 ||
          screenY + scaledSize < -80 ||
          screenX > width + 80 ||
          screenY > height + 80
        ) {
          return null;
        }

        return (
          <div
            key={worker.uniqueKey}
            className="pointer-events-none absolute hidden transition-opacity duration-150 sm:block"
            style={{
              left: screenX - 90,
              top: screenY - scaledSize / 2 - 28,
              width: 180,
              opacity: isHovered ? 1 : 0.2,
            }}
          >
            <div
              className="rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm"
              title={worker.displayName}
            >
              <div className="flex flex-col items-center leading-none">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-300">
                    Lv.{level}
                  </span>
                  <span className="truncate">{worker.displayName}</span>
                </div>

                <div className="mt-1 text-center text-[10px] text-yellow-200/90">
                  {getWalkerTitleForLevel(level)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {(
        hoveredWorker ??
        workers.find((worker) => worker.uniqueKey === selectedWorkerKey)
      ) ? (
        <WorkerTooltip
          worker={
            hoveredWorker ??
            workers.find((worker) => worker.uniqueKey === selectedWorkerKey)!
          }
        />
      ) : null}
    </div>
  );
}