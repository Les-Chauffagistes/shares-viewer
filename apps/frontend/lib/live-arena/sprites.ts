import { FRAME_COLUMNS, FRAME_ROWS } from "./constants";
import { Direction, LoadedSpriteSheet } from "./types";

export const LEVEL_TITLES = [
  "Gueux des Blocs",
  "Collecteur de Hash",
  "Apprenti Mineur",
  "Mineur Rustique",
  "Frappeur de SHA",
  "Garde de la Chaîne",
  "Traqueur de Nonce",
  "Archer du Hashrate",
  "Soldat des Blocs",
  "Capitaine de Pool",
  "Gardien du Ledger",
  "Forgeron de Difficulté",
  "Maître des Shares",
  "Mercenaire du Réseau",
  "Champion du Hash",
  "Chevalier du Bloc",
  "Chevalier du Consensus",
  "Exécuteur SHA-256",
  "Héros de la Blockchain",
  "Guerrier Légendaire",
] as const;

export const AVAILABLE_WALKER_FILES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const UNIFORM_FRAME_SIZE = 64;
const CONTENT_PADDING = 6;

export function getWalkerSource(index: number) {
  const safeIndex = Math.max(0, index);
  const fileNumber = String(safeIndex + 1).padStart(3, "0");
  return `/sprites/workers/walker_${fileNumber}.png`;
}

export function getWalkerSourceFromFileNumber(fileNumber: number) {
  const safeFileNumber = Math.max(1, fileNumber);
  return `/sprites/workers/walker_${String(safeFileNumber).padStart(3, "0")}.png`;
}

export function getWalkerIndexForLevel(level: number) {
  const safeLevel = Math.max(1, level || 1);
  const stepIndex = Math.floor((safeLevel - 1) / 5);
  return Math.min(stepIndex, LEVEL_TITLES.length - 1);
}

export function getWalkerTitleForLevel(level: number) {
  return LEVEL_TITLES[getWalkerIndexForLevel(level)];
}

export function getSafeWalkerIndexForLevel(
  level: number,
  loadedSpritesCount: number,
) {
  if (loadedSpritesCount <= 0) return 0;
  return Math.min(getWalkerIndexForLevel(level), loadedSpritesCount - 1);
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

type AlphaBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

function getOpaqueBounds(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alphaThreshold = 8,
): AlphaBounds | null {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const index = (py * width + px) * 4;
      const alpha = data[index + 3];

      if (alpha > alphaThreshold) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Transforme une spritesheet 9x4 quelconque en spritesheet 9x4 uniforme.
 * Chaque frame finale fait 64x64 et le contenu du perso est auto-recadré,
 * redimensionné et centré pour garder une taille visuelle cohérente.
 */
export function normalizeSpriteSheetTo64(
  source: HTMLCanvasElement,
  sourceFrameWidth: number,
  sourceFrameHeight: number,
): HTMLCanvasElement {
  const normalized = document.createElement("canvas");
  normalized.width = FRAME_COLUMNS * UNIFORM_FRAME_SIZE;
  normalized.height = FRAME_ROWS * UNIFORM_FRAME_SIZE;

  const destCtx = normalized.getContext("2d");
  const srcCtx = source.getContext("2d");

  if (!destCtx || !srcCtx) return normalized;

  destCtx.imageSmoothingEnabled = false;

  for (let row = 0; row < FRAME_ROWS; row++) {
    for (let col = 0; col < FRAME_COLUMNS; col++) {
      const sx = col * sourceFrameWidth;
      const sy = row * sourceFrameHeight;
      const dx = col * UNIFORM_FRAME_SIZE;
      const dy = row * UNIFORM_FRAME_SIZE;

      const bounds = getOpaqueBounds(
        srcCtx,
        sx,
        sy,
        sourceFrameWidth,
        sourceFrameHeight,
      );

      if (!bounds) {
        continue;
      }

      const availableSize = UNIFORM_FRAME_SIZE - CONTENT_PADDING * 2;
      const scale = Math.min(
        availableSize / bounds.width,
        availableSize / bounds.height,
      );

      const drawWidth = Math.max(1, Math.round(bounds.width * scale));
      const drawHeight = Math.max(1, Math.round(bounds.height * scale));

      const offsetX = Math.floor((UNIFORM_FRAME_SIZE - drawWidth) / 2);
      const offsetY = Math.floor((UNIFORM_FRAME_SIZE - drawHeight) / 2);

      destCtx.drawImage(
        source,
        sx + bounds.minX,
        sy + bounds.minY,
        bounds.width,
        bounds.height,
        dx + offsetX,
        dy + offsetY,
        drawWidth,
        drawHeight,
      );
    }
  }

  return normalized;
}

export async function loadSpriteSheets(): Promise<LoadedSpriteSheet[]> {
  return Promise.all(
    AVAILABLE_WALKER_FILES.map((fileNumber) => {
      const src = getWalkerSourceFromFileNumber(fileNumber);

      return new Promise<LoadedSpriteSheet>((resolve, reject) => {
        const img = new Image();
        img.src = src;

        img.onload = () => {
          if (
            img.width % FRAME_COLUMNS !== 0 ||
            img.height % FRAME_ROWS !== 0
          ) {
            reject(
              new Error(
                `Spritesheet invalide pour ${src} : dimensions ${img.width}x${img.height} non divisibles par ${FRAME_COLUMNS}x${FRAME_ROWS}`,
              ),
            );
            return;
          }

          const cleaned = removeUniformBackground(img);
          const sourceFrameWidth = img.width / FRAME_COLUMNS;
          const sourceFrameHeight = img.height / FRAME_ROWS;

          const normalized = normalizeSpriteSheetTo64(
            cleaned,
            sourceFrameWidth,
            sourceFrameHeight,
          );

          resolve({
            source: src,
            image: normalized,
            frameWidth: UNIFORM_FRAME_SIZE,
            frameHeight: UNIFORM_FRAME_SIZE,
          });
        };

        img.onerror = () => {
          reject(
            new Error(
              `Impossible de charger le sprite déclaré dans AVAILABLE_WALKER_FILES : ${src}`,
            ),
          );
        };
      });
    }),
  );
}