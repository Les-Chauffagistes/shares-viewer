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

/**
 * Mets ici UNIQUEMENT les sprites qui existent vraiment.
 * Exemple :
 * - walker_001.png => 1
 * - walker_002.png => 2
 * - walker_005.png => 5
 */
export const AVAILABLE_WALKER_FILES = [1, 2, 3] as const;

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

/**
 * Retourne un index d'ARRAY chargé, pas un numéro de fichier.
 * Exemple :
 * AVAILABLE_WALKER_FILES = [1, 2, 5]
 * - si le level veut le skin #1 => index array 0
 * - si le level veut le skin #2 => index array 1
 * - si le level veut le skin #20 => on clamp sur le dernier => index array 2
 */
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

export async function loadSpriteSheets(): Promise<LoadedSpriteSheet[]> {
  return Promise.all(
    AVAILABLE_WALKER_FILES.map((fileNumber) => {
      const src = getWalkerSourceFromFileNumber(fileNumber);

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