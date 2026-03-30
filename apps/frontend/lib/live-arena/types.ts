export type LiveWorkerState = {
  address: string;
  workerName: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
  uniqueKey: string;
  level?: number;
};

export type LiveStatePayload = {
  type?: "live_state";
  round: string | null;
  workers: LiveWorkerState[];
};

export type Direction = "up" | "down" | "left" | "right";

export type LoadedSpriteSheet = {
  source: string;
  image: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
};

export type MapObstacleKind =
  | "building"
  | "parkFence"
  | "lake"
  | "bench"
  | "tree"
  | "statue";

export type MapObstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MapObstacleKind;
  color?: string;
};

export type ArenaWorker = LiveWorkerState & {
  x: number;
  y: number;
  angle: number;
  speed: number;
  direction: Direction;
  frame: number;
  frameTimer: number;
  spriteIndex: number;
  pauseTimer: number;
  decisionTimer: number;
  turnCooldown: number;
  radius: number;
};