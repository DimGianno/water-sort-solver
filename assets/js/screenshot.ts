import { COLOR_PALETTE, DEFAULT_COLORS, type ColorName } from "./constants.ts";

interface PixelSource {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface BottleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: number;
}

interface ScreenshotContext {
  el: <T extends HTMLElement = HTMLElement>(id: string) => T;
  applyImport: (payload: ScreenshotPayload) => void;
}

export interface ScreenshotPayload {
  v: 1;
  n: number;
  colors: string[];
  layers: string[][];
}

export interface ScreenshotRecognition {
  payload: ScreenshotPayload;
  bottleCount: number;
  colorCount: number;
  confidence: "high" | "review";
}

const ANALYSIS_WIDTH = 480;
const LAYER_CENTERS = [0.25, 0.455, 0.66, 0.865] as const;
const EMPTY_MAX_CHANNEL = 58;
const MAX_PROFILE_DISTANCE = 76;

const GAME_COLOR_PROFILES: Record<ColorName, Rgb[]> = {
  Red: [{ r: 181, g: 57, b: 45 }],
  Pink: [{ r: 219, g: 103, b: 124 }],
  Orange: [{ r: 219, g: 144, b: 81 }],
  Yellow: [{ r: 237, g: 219, b: 109 }],
  Green: [{ r: 127, g: 149, b: 48 }],
  "Dark Green": [{ r: 47, g: 100, b: 56 }],
  "Light Green": [{ r: 129, g: 212, b: 134 }],
  Blue: [{ r: 56, g: 47, b: 188 }],
  "Light Blue": [{ r: 103, g: 161, b: 224 }],
  Purple: [{ r: 105, g: 48, b: 143 }],
  Gray: [{ r: 100, g: 100, b: 102 }],
  Brown: [{ r: 119, g: 76, b: 26 }],
};

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const COLOR_PROFILES = Object.fromEntries(
  DEFAULT_COLORS.map((color) => [
    color,
    [...GAME_COLOR_PROFILES[color], hexToRgb(COLOR_PALETTE[color])],
  ]),
) as Record<ColorName, Rgb[]>;

function median(values: number[]): number {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function isOutlinePixel(r: number, g: number, b: number): boolean {
  const brightest = Math.max(r, g, b);
  const darkest = Math.min(r, g, b);
  return darkest >= 105 && brightest - darkest <= 30;
}

function findBottleCandidates(source: PixelSource): BottleBounds[] {
  const { width, height, data } = source;
  const mask = new Uint8Array(width * height);

  for (let index = 0; index < mask.length; index++) {
    const pixel = index * 4;
    if (isOutlinePixel(data[pixel], data[pixel + 1], data[pixel + 2])) {
      mask[index] = 1;
    }
  }

  const seen = new Uint8Array(mask.length);
  const candidates: BottleBounds[] = [];
  const stack: number[] = [];
  const minimumY = Math.floor(height * 0.2);

  for (let y = minimumY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!mask[start] || seen[start]) continue;

      seen[start] = 1;
      stack.push(start);
      let pixels = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (stack.length) {
        const current = stack.pop() as number;
        const currentY = Math.floor(current / width);
        const currentX = current - currentY * width;
        pixels++;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (
          let nextY = Math.max(minimumY, currentY - 1);
          nextY <= Math.min(height - 1, currentY + 1);
          nextY++
        ) {
          for (
            let nextX = Math.max(0, currentX - 1);
            nextX <= Math.min(width - 1, currentX + 1);
            nextX++
          ) {
            const next = nextY * width + nextX;
            if (mask[next] && !seen[next]) {
              seen[next] = 1;
              stack.push(next);
            }
          }
        }
      }

      const candidateWidth = maxX - minX + 1;
      const candidateHeight = maxY - minY + 1;
      if (
        pixels > 120 &&
        candidateHeight > candidateWidth * 2.2 &&
        candidateHeight > height * 0.1 &&
        candidateWidth > width * 0.025 &&
        candidateWidth < width * 0.2
      ) {
        candidates.push({
          x: minX,
          y: minY,
          width: candidateWidth,
          height: candidateHeight,
          pixels,
        });
      }
    }
  }

  return candidates;
}

function selectConsistentBottles(candidates: BottleBounds[]): BottleBounds[] {
  if (!candidates.length) return [];

  let bestGroup: BottleBounds[] = [];
  for (const seed of candidates) {
    const group = candidates.filter(
      (candidate) =>
        Math.abs(candidate.width - seed.width) / seed.width <= 0.22 &&
        Math.abs(candidate.height - seed.height) / seed.height <= 0.18,
    );
    if (group.length > bestGroup.length) bestGroup = group;
  }

  if (bestGroup.length > 14) {
    bestGroup = [...bestGroup]
      .sort((left, right) => right.pixels - left.pixels)
      .slice(0, 14);
  }

  const typicalHeight = median(bestGroup.map((bottle) => bottle.height));
  const rows: BottleBounds[][] = [];
  for (const bottle of [...bestGroup].sort((a, b) => a.y - b.y)) {
    const centerY = bottle.y + bottle.height / 2;
    const row = rows.find((items) => {
      const rowCenter =
        items.reduce((sum, item) => sum + item.y + item.height / 2, 0) /
        items.length;
      return Math.abs(centerY - rowCenter) <= typicalHeight * 0.42;
    });
    if (row) row.push(bottle);
    else rows.push([bottle]);
  }

  return rows
    .sort((left, right) => left[0].y - right[0].y)
    .flatMap((row) => row.sort((left, right) => left.x - right.x));
}

function sampleLayer(
  source: PixelSource,
  bottle: BottleBounds,
  fraction: number,
): Rgb {
  const centerX = Math.round(bottle.x + bottle.width / 2);
  const centerY = Math.round(bottle.y + bottle.height * fraction);
  const radiusX = Math.max(2, Math.round(bottle.width * 0.12));
  const radiusY = Math.max(2, Math.round(bottle.height * 0.015));
  const channels: [number[], number[], number[]] = [[], [], []];

  for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      const pixel = (y * source.width + x) * 4;
      channels[0].push(source.data[pixel]);
      channels[1].push(source.data[pixel + 1]);
      channels[2].push(source.data[pixel + 2]);
    }
  }

  return {
    r: median(channels[0]),
    g: median(channels[1]),
    b: median(channels[2]),
  };
}

function rgbDistance(left: Rgb, right: Rgb): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function recognizeColor(sample: Rgb): {
  color: ColorName | "";
  distance: number;
} {
  if (Math.max(sample.r, sample.g, sample.b) < EMPTY_MAX_CHANNEL) {
    return { color: "", distance: 0 };
  }

  let bestColor: ColorName | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of DEFAULT_COLORS) {
    for (const profile of COLOR_PROFILES[color]) {
      const distance = rgbDistance(sample, profile);
      if (distance < bestDistance) {
        bestColor = color;
        bestDistance = distance;
      }
    }
  }

  if (!bestColor || bestDistance > MAX_PROFILE_DISTANCE) {
    if (Math.max(sample.r, sample.g, sample.b) < 100) {
      return { color: "", distance: bestDistance };
    }
    throw new Error(
      "A liquid color could not be matched. Try a screenshot without overlays or animations.",
    );
  }
  return { color: bestColor, distance: bestDistance };
}

export function recognizeScreenshotPixels(
  source: PixelSource,
): ScreenshotRecognition {
  const bottles = selectConsistentBottles(findBottleCandidates(source));
  if (bottles.length < 4 || bottles.length > 14) {
    throw new Error(
      "Could not find between 4 and 14 complete bottles in the screenshot.",
    );
  }

  let greatestDistance = 0;
  const layers = bottles.map((bottle) =>
    LAYER_CENTERS.map((fraction) => {
      const recognized = recognizeColor(sampleLayer(source, bottle, fraction));
      greatestDistance = Math.max(greatestDistance, recognized.distance);
      return recognized.color;
    }),
  );

  for (let bottle = 0; bottle < layers.length; bottle++) {
    let foundLiquid = false;
    for (const color of layers[bottle]) {
      if (color) foundLiquid = true;
      else if (foundLiquid) {
        throw new Error(
          `Bottle ${bottle + 1} was read with a gap below liquid. Retake the screenshot after the pour animation finishes.`,
        );
      }
    }
  }

  const counts = new Map<ColorName, number>();
  for (const bottle of layers) {
    for (const color of bottle) {
      if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  const colors = DEFAULT_COLORS.filter((color) => counts.has(color));
  const expectedColorCount = bottles.length - 2;
  if (colors.length !== expectedColorCount) {
    throw new Error(
      `Detected ${colors.length} colors for ${bottles.length} bottles; expected ${expectedColorCount}. Make sure every bottle is fully visible.`,
    );
  }
  for (const color of colors) {
    if (counts.get(color) !== 4) {
      throw new Error(
        `${color} was detected ${counts.get(color)} times instead of 4. Review the screenshot for a moving or covered layer.`,
      );
    }
  }

  return {
    payload: {
      v: 1,
      n: bottles.length,
      colors,
      layers,
    },
    bottleCount: bottles.length,
    colorCount: colors.length,
    confidence: greatestDistance <= 30 ? "high" : "review",
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("The selected image could not be opened."));
      },
      { once: true },
    );
    reader.addEventListener(
      "error",
      () => reject(new Error("The selected image could not be opened.")),
      { once: true },
    );
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  const dataUrl = await readFileAsDataUrl(file);
  await new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("The selected image could not be opened.")),
      { once: true },
    );
    image.src = dataUrl;
  });
  return image;
}

export async function recognizeScreenshotFile(
  file: File,
): Promise<ScreenshotRecognition> {
  const image = await loadImage(file);
  const width = Math.min(ANALYSIS_WIDTH, image.naturalWidth);
  const height = Math.max(
    1,
    Math.round((image.naturalHeight * width) / image.naturalWidth),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image recognition is unavailable here.");
  context.drawImage(image, 0, 0, width, height);
  return recognizeScreenshotPixels(context.getImageData(0, 0, width, height));
}

export function createScreenshotImport(ctx: ScreenshotContext) {
  const { el, applyImport } = ctx;
  let pending: ScreenshotRecognition | null = null;
  let previewUrl: string | null = null;

  function clearPreviewUrl(): void {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function closeScreenshotImport(): void {
    clearPreviewUrl();
    pending = null;
    el("screenshotArea").hidden = true;
    el<HTMLImageElement>("screenshotPreview").removeAttribute("src");
    el("screenshotMsg").textContent = "";
    el<HTMLInputElement>("screenshotInput").value = "";
    el<HTMLButtonElement>("screenshotApplyBtn").disabled = true;
  }

  function chooseScreenshot(): void {
    el<HTMLInputElement>("screenshotInput").click();
  }

  async function onScreenshotSelected(): Promise<void> {
    const input = el<HTMLInputElement>("screenshotInput");
    const file = input.files?.[0];
    if (!file) return;

    clearPreviewUrl();
    pending = null;
    el("screenshotArea").hidden = false;
    previewUrl = URL.createObjectURL(file);
    el<HTMLImageElement>("screenshotPreview").src = previewUrl;
    const message = el("screenshotMsg");
    const applyButton = el<HTMLButtonElement>("screenshotApplyBtn");
    message.dataset.tone = "working";
    message.textContent = "Reading bottles and colors on this device...";
    applyButton.disabled = true;

    try {
      pending = await recognizeScreenshotFile(file);
      message.dataset.tone = pending.confidence;
      message.textContent = `Detected ${pending.bottleCount} bottles and ${pending.colorCount} colors. Apply the result, then review every layer.`;
      applyButton.disabled = false;
    } catch (error) {
      message.dataset.tone = "error";
      message.textContent =
        error instanceof Error
          ? error.message
          : "Screenshot recognition failed.";
    }
  }

  function applyScreenshot(): void {
    if (!pending) return;
    applyImport(pending.payload);
    el("screenshotMsg").dataset.tone = "high";
    el("screenshotMsg").textContent =
      "Puzzle applied. Review the bottle layers before solving.";
    el("bottleArea").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return {
    chooseScreenshot,
    onScreenshotSelected,
    applyScreenshot,
    closeScreenshotImport,
  };
}
