import { FRAME_COUNT, WORLD_HEIGHT, WORLD_PADDING, WORLD_WIDTH } from "./constants";
import {
  clampWorkerInWorld,
  collidesWithObstacle,
  circlesOverlap,
} from "./collisions";
import { hashString, normalizeAngle } from "./math";
import { MapObstacle, ArenaWorker, Direction } from "./types";

export function pickDirectionFromAngle(angle: number): Direction {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }

  return dy >= 0 ? "down" : "up";
}

export function stepWorkers(
  current: ArenaWorker[],
  dt: number,
  now: number,
  obstacles: MapObstacle[],
): ArenaWorker[] {
  const updated = current.map((worker, index) => {
    let angle = worker.angle;
    let x = worker.x;
    let y = worker.y;
    let pauseTimer = Math.max(0, worker.pauseTimer - dt);
    let decisionTimer = worker.decisionTimer - dt;
    let turnCooldown = Math.max(0, worker.turnCooldown - dt);

    const seed = hashString(`${worker.uniqueKey}-${Math.floor(now / 400)}`);

    if (decisionTimer <= 0) {
      const behaviorRoll = seed % 100;

      if (behaviorRoll < 18) {
        pauseTimer = 0.5 + ((seed >> 3) % 140) / 100;
      } else if (behaviorRoll < 55) {
        angle += ((((seed >> 5) % 120) - 60) * Math.PI) / 180;
      } else if (behaviorRoll < 72) {
        angle += Math.PI;
      } else {
        angle += ((((seed >> 4) % 50) - 25) * Math.PI) / 180;
      }

      angle = normalizeAngle(angle);
      decisionTimer = 0.7 + ((seed >> 2) % 180) / 100;
    }

    const isMoving = pauseTimer <= 0;
    let frame = worker.frame;
    let frameTimer = worker.frameTimer;

    if (isMoving) {
      const moveX = Math.cos(angle) * worker.speed * dt;
      const moveY = Math.sin(angle) * worker.speed * dt;

      let nextX = x + moveX;
      let nextY = y + moveY;

      const radius = worker.radius;

      if (nextX - radius <= WORLD_PADDING) {
        nextX = WORLD_PADDING + radius;
        angle = Math.PI - angle;
        pauseTimer = 0.1;
      } else if (nextX + radius >= WORLD_WIDTH - WORLD_PADDING) {
        nextX = WORLD_WIDTH - WORLD_PADDING - radius;
        angle = Math.PI - angle;
        pauseTimer = 0.1;
      }

      if (nextY - radius <= WORLD_PADDING) {
        nextY = WORLD_PADDING + radius;
        angle = -angle;
        pauseTimer = 0.1;
      } else if (nextY + radius >= WORLD_HEIGHT - WORLD_PADDING) {
        nextY = WORLD_HEIGHT - WORLD_PADDING - radius;
        angle = -angle;
        pauseTimer = 0.1;
      }

      angle = normalizeAngle(angle);

      if (collidesWithObstacle(nextX, nextY, radius, obstacles)) {
        if (!collidesWithObstacle(nextX, y, radius, obstacles)) {
          x = nextX;
          angle = -angle;
        } else if (!collidesWithObstacle(x, nextY, radius, obstacles)) {
          y = nextY;
          angle = Math.PI - angle;
        } else {
          angle += Math.PI / 2 + (((seed >> 1) % 120) * Math.PI) / 180;
          pauseTimer = 0.2 + ((seed >> 6) % 50) / 100;
        }

        angle = normalizeAngle(angle);
      } else {
        x = nextX;
        y = nextY;
      }

      frameTimer += dt;
      if (frameTimer >= 0.11) {
        frame = (frame + 1) % FRAME_COUNT;
        frameTimer = 0;
      }
    } else {
      frame = 0;
      frameTimer = 0;
    }

    if (index % 13 === 0 && turnCooldown <= 0 && isMoving) {
      angle += 0.01;
      turnCooldown = 0.35;
    }

    return {
      ...worker,
      x,
      y,
      angle: normalizeAngle(angle),
      direction: pickDirectionFromAngle(angle),
      frame,
      frameTimer,
      pauseTimer,
      decisionTimer,
      turnCooldown,
    };
  });

  for (let i = 0; i < updated.length; i += 1) {
    for (let j = i + 1; j < updated.length; j += 1) {
      const a = updated[i];
      const b = updated[j];

      if (!circlesOverlap(a.x, a.y, a.radius, b.x, b.y, b.radius)) {
        continue;
      }

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.0001) {
        dx = 1;
        dy = 0;
        dist = 1;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = a.radius + b.radius - dist;
      const push = overlap / 2 + 0.5;

      const aCandidate = {
        x: a.x - nx * push,
        y: a.y - ny * push,
      };

      const bCandidate = {
        x: b.x + nx * push,
        y: b.y + ny * push,
      };

      if (!collidesWithObstacle(aCandidate.x, aCandidate.y, a.radius, obstacles)) {
        const clamped = clampWorkerInWorld(aCandidate.x, aCandidate.y, a.radius);
        a.x = clamped.x;
        a.y = clamped.y;
      }

      if (!collidesWithObstacle(bCandidate.x, bCandidate.y, b.radius, obstacles)) {
        const clamped = clampWorkerInWorld(bCandidate.x, bCandidate.y, b.radius);
        b.x = clamped.x;
        b.y = clamped.y;
      }

      a.angle = normalizeAngle(a.angle + Math.PI / 2);
      b.angle = normalizeAngle(b.angle - Math.PI / 2);

      a.pauseTimer = Math.max(a.pauseTimer, 0.12);
      b.pauseTimer = Math.max(b.pauseTimer, 0.12);

      a.direction = pickDirectionFromAngle(a.angle);
      b.direction = pickDirectionFromAngle(b.angle);
    }
  }

  return [...updated];
}