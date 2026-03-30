import { FRAME_COLUMNS, FRAME_ROWS } from "./constants";
import { Direction, LoadedSpriteSheet } from "./types";

export function getWalkerSource(index: number) {
  const fileNumber = String(index + 1).padStart(3, "0");
  return `/sprites/workers/walker_${fileNumber}.png`;
}

// ordre: up, left, down, right
export function directionToRow(direction: Direction): number {
  switch (direction) {
    case "up":
      return 0;
    case "left":
      return 1;
    case "down":
      return 2;
    case "right":
      return 3;
    default:
      return 2;
  }
}

export function removeUniformBackground(
  source: HTMLImageElement,
  tolerance = 18,
): HTMLCanvasElement {
  const offscreen = document.createElement("canvas");
  offscreen.width = source.width;
  offscreen.height = source.height;

  const ctx = offscreen.getContext("2d");
  if (!ctx) return offscreen;

  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isNearBackground =
      Math.abs(r - bgR) <= tolerance &&
      Math.abs(g - bgG) <= tolerance &&
      Math.abs(b - bgB) <= tolerance;

    if (isNearBackground) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

export async function loadSpriteSheets(walkerCount: number): Promise<LoadedSpriteSheet[]> {
  return Promise.all(
    Array.from({ length: walkerCount }, (_, index) => {
      const src = getWalkerSource(index);

      return new Promise<LoadedSpriteSheet>((resolve, reject) => {
        const img = new Image();
        img.src = src;

        img.onload = () => {
          resolve({
            source: src,
            image: removeUniformBackground(img),
            frameWidth: img.width / FRAME_COLUMNS,
            frameHeight: img.height / FRAME_ROWS,
          });
        };

        img.onerror = () => {
          reject(new Error(`Impossible de charger le sprite ${src}`));
        };
      });
    }),
  );
}