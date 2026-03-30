import {
  WORLD_HEIGHT,
  WORLD_PADDING,
  WORLD_WIDTH,
  FRAME_COUNT,
} from "./constants";
import { collidesWithObstacle, circlesOverlap } from "./collisions";
import { hashString } from "./math";
import { ArenaWorker, LiveWorkerState, MapObstacle } from "./types";

function randomFromSeed(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getMinBestShare(workers: Pick<LiveWorkerState, "bestShare">[]) {
  if (workers.length === 0) return 0;
  return Math.min(...workers.map((worker) => worker.bestShare));
}

export function getMaxBestShare(workers: Pick<LiveWorkerState, "bestShare">[]) {
  if (workers.length === 0) return 0;
  return Math.max(...workers.map((worker) => worker.bestShare));
}

export function getWorkerScreenSize(
  workerBestShare: number,
  minBestShare: number,
  maxBestShare: number,
) {
  const baseSize = 36;
  const maxSize = 128;

  const safeMin = Math.max(minBestShare, 1);
  const safeMax = Math.max(maxBestShare, safeMin);
  const safeWorker = Math.max(workerBestShare, safeMin);

  if (safeMax === safeMin) {
    return baseSize;
  }

  const ratio = safeWorker / safeMin;
  const maxRatio = safeMax / safeMin;

  // < 1 compresse les écarts
  // = 1 garde les écarts relatifs
  // > 1 accentue les écarts
  const coefficient = 0.6;

  const scaled = Math.pow(ratio, coefficient);
  const scaledMax = Math.pow(maxRatio, coefficient);

  const normalized =
    scaledMax <= 1 ? 0 : (scaled - 1) / (scaledMax - 1);

  return baseSize + normalized * (maxSize - baseSize);
}

export function getWorkerRadiusFromBestShare(
  workerBestShare: number,
  minBestShare: number,
  maxBestShare: number,
) {
  const screenSize = getWorkerScreenSize(
    workerBestShare,
    minBestShare,
    maxBestShare,
  );

  return screenSize * 0.32;
}

export function getWorkerBaseSpeed(worker: LiveWorkerState, index: number) {
  const hash = hashString(`${worker.address}-${worker.workerName}-${index}`);
  return 22 + (hash % 18);
}

export function getWorkerSpriteIndex(
  worker: LiveWorkerState,
  spriteCount: number,
) {
  if (spriteCount <= 0) return 0;
  const seed = worker.uniqueKey || `${worker.address}-${worker.workerName}`;
  return hashString(seed) % spriteCount;
}

function findSpawnPosition(
  radius: number,
  uniqueSeed: string,
  obstacles: MapObstacle[],
  placedWorkers: ArenaWorker[],
) {
  const maxAttempts = 120;
  const base = hashString(uniqueSeed);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sx = randomFromSeed(base + attempt * 17);
    const sy = randomFromSeed(base + attempt * 29);

    const x =
      radius +
      WORLD_PADDING +
      sx * (WORLD_WIDTH - 2 * (radius + WORLD_PADDING));
    const y =
      radius +
      WORLD_PADDING +
      sy * (WORLD_HEIGHT - 2 * (radius + WORLD_PADDING));

    if (collidesWithObstacle(x, y, radius, obstacles)) {
      continue;
    }

    const overlapsWorker = placedWorkers.some((other) =>
      circlesOverlap(x, y, radius, other.x, other.y, other.radius),
    );

    if (overlapsWorker) {
      continue;
    }

    return { x, y };
  }

  return {
    x: radius + WORLD_PADDING + 40,
    y: radius + WORLD_PADDING + 40,
  };
}

export function buildArenaWorkers(
  workers: LiveWorkerState[],
  spriteCount: number,
  obstacles: MapObstacle[],
): ArenaWorker[] {
  const placed: ArenaWorker[] = [];
  const minBestShare = getMinBestShare(workers);
  const maxBestShare = getMaxBestShare(workers);

  for (let index = 0; index < workers.length; index += 1) {
    const worker = workers[index];
    const hash = hashString(`${worker.workerName}-${worker.address}-${index}`);
    const radius = getWorkerRadiusFromBestShare(
      worker.bestShare,
      minBestShare,
      maxBestShare,
    );

    const spawn = findSpawnPosition(
      radius,
      worker.uniqueKey || `${worker.address}-${worker.workerName}`,
      obstacles,
      placed,
    );

    placed.push({
      ...worker,
      x: spawn.x,
      y: spawn.y,
      angle: ((hash % 360) * Math.PI) / 180,
      speed: getWorkerBaseSpeed(worker, index),
      direction: "down",
      frame: hash % FRAME_COUNT,
      frameTimer: 0,
      spriteIndex: getWorkerSpriteIndex(worker, spriteCount),
      pauseTimer: (hash % 200) / 100,
      decisionTimer: 0.8 + ((hash >> 2) % 150) / 100,
      turnCooldown: 0.2 + ((hash >> 4) % 90) / 100,
      radius,
    });
  }

  return placed;
}