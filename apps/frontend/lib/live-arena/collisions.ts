import { WORLD_HEIGHT, WORLD_PADDING, WORLD_WIDTH } from "./constants";
import { clamp } from "./math";
import { MapObstacle } from "./types";

export function circleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rect: MapObstacle,
) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.width);
  const nearestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export function collidesWithObstacle(
  x: number,
  y: number,
  radius: number,
  obstacles: MapObstacle[],
) {
  return obstacles.some((obstacle) => circleRectCollision(x, y, radius, obstacle));
}

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
) {
  const dx = ax - bx;
  const dy = ay - by;
  const minDist = ar + br;
  return dx * dx + dy * dy < minDist * minDist;
}

export function clampWorkerInWorld(x: number, y: number, radius: number) {
  return {
    x: clamp(x, radius + WORLD_PADDING, WORLD_WIDTH - radius - WORLD_PADDING),
    y: clamp(y, radius + WORLD_PADDING, WORLD_HEIGHT - radius - WORLD_PADDING),
  };
}