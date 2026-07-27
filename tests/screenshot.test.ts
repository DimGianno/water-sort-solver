import { describe, expect, it } from "vitest";

import { recognizeScreenshotPixels } from "../assets/js/screenshot.ts";

type RgbTuple = readonly [number, number, number];

const BACKGROUND: RgbTuple = [15, 6, 18];
const OUTLINE: RgbTuple = [202, 202, 202];
const COLORS: Record<string, RgbTuple> = {
  Red: [181, 57, 45],
  Pink: [219, 103, 124],
  Orange: [219, 144, 81],
  Green: [127, 149, 48],
  "Light Green": [129, 212, 134],
  Blue: [56, 47, 188],
  "Light Blue": [103, 161, 224],
  Purple: [105, 48, 143],
  Gray: [100, 100, 102],
};

const IN_PROGRESS_LAYERS = [
  ["Purple", "Purple", "Purple", "Light Green"],
  ["Green", "Green", "Green", "Green"],
  ["Blue", "Blue", "Purple", "Blue"],
  ["Orange", "Orange", "Orange", "Orange"],
  ["", "Gray", "Gray", "Gray"],
  ["", "Red", "Red", "Red"],
  ["", "Light Green", "Light Green", "Red"],
  ["", "", "Blue", "Gray"],
  ["", "", "", "Light Green"],
  ["Light Blue", "Light Blue", "Light Blue", "Light Blue"],
  ["Pink", "Pink", "Pink", "Pink"],
];

function createRaster(scale = 1) {
  const width = Math.round(480 * scale);
  const height = Math.round(1042 * scale);
  const data = new Uint8ClampedArray(width * height * 4);

  function paintPixel(x: number, y: number, color: RgbTuple): void {
    const index = (y * width + x) * 4;
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = 255;
  }

  function fillRect(
    x: number,
    y: number,
    rectWidth: number,
    rectHeight: number,
    color: RgbTuple,
  ): void {
    for (let row = y; row < y + rectHeight; row++) {
      for (let column = x; column < x + rectWidth; column++) {
        paintPixel(column, row, color);
      }
    }
  }

  fillRect(0, 0, width, height, BACKGROUND);

  const positions = [
    ...[18, 95, 173, 250, 327, 404].map((x) => [x, 309]),
    ...[31, 121, 211, 301, 391].map((x) => [x, 611]),
  ];
  const bottleWidth = 58;
  const bottleHeight = 211;
  const stroke = 4;
  const sampleFractions = [0.25, 0.455, 0.66, 0.865];

  for (let index = 0; index < positions.length; index++) {
    const [sourceX, sourceY] = positions[index];
    const x = Math.round(sourceX * scale);
    const y = Math.round(sourceY * scale);
    const scaledWidth = Math.round(bottleWidth * scale);
    const scaledHeight = Math.round(bottleHeight * scale);
    const scaledStroke = Math.max(2, Math.round(stroke * scale));

    fillRect(x, y, scaledWidth, scaledStroke, OUTLINE);
    fillRect(x, y, scaledStroke, scaledHeight, OUTLINE);
    fillRect(
      x + scaledWidth - scaledStroke,
      y,
      scaledStroke,
      scaledHeight,
      OUTLINE,
    );
    fillRect(
      x,
      y + scaledHeight - scaledStroke,
      scaledWidth,
      scaledStroke,
      OUTLINE,
    );

    for (let layer = 0; layer < 4; layer++) {
      const color = IN_PROGRESS_LAYERS[index][layer];
      if (!color) continue;
      const centerY = Math.round(y + scaledHeight * sampleFractions[layer]);
      const layerHeight = Math.round(scaledHeight * 0.19);
      fillRect(
        x + scaledStroke,
        centerY - Math.floor(layerHeight / 2),
        scaledWidth - scaledStroke * 2,
        layerHeight,
        COLORS[color],
      );
    }
  }

  return { width, height, data };
}

describe("offline screenshot recognition", () => {
  it.each([1, 1.5])(
    "recognizes an in-progress puzzle at %sx resolution",
    (scale) => {
      const result = recognizeScreenshotPixels(createRaster(scale));

      expect(result.bottleCount).toBe(11);
      expect(result.colorCount).toBe(9);
      expect(result.confidence).toBe("high");
      expect(result.payload.layers).toEqual(IN_PROGRESS_LAYERS);
      expect(result.payload.colors).toEqual([
        "Red",
        "Pink",
        "Orange",
        "Green",
        "Light Green",
        "Blue",
        "Light Blue",
        "Purple",
        "Gray",
      ]);
    },
  );

  it("rejects images without visible bottle outlines", () => {
    const source = createRaster();
    source.data.fill(0);

    expect(() => recognizeScreenshotPixels(source)).toThrow(
      "Could not find between 4 and 14 complete bottles",
    );
  });
});
