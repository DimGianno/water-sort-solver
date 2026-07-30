import { describe, expect, test } from "vitest";

import { CAP, DEFAULT_COLORS } from "../assets/js/constants.ts";
import { createImportExport } from "../assets/js/io.ts";

interface FixtureOptions {
  clipboard?: { writeText: (value: string) => Promise<void> };
  copyCommand?: (command: string) => boolean;
  validationError?: string | null;
}

const COMPACT_COLOR_NAMES = [
  "Red",
  "Pink",
  "Orange",
  "Yellow",
  "Green",
  "Dark Green",
  "Light Green",
  "Blue",
  "Light Blue",
  "Purple",
  "Gray",
  "Brown",
] as const;

function encodePayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return encodeBytes(bytes);
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `WS1:${btoa(binary)}`;
}

function filledBottle(color = ""): string[] {
  return Array<string>(CAP).fill(color);
}

function encodeCompactPuzzle(
  layers: string[][],
  version = 1,
): { bytes: Uint8Array; code: string } {
  const bytes = new Uint8Array(1 + layers.length * 2);
  bytes[0] = (version << 4) | layers.length;

  let slot = 0;
  for (const bottle of layers) {
    if (bottle.length !== CAP) throw new Error("Invalid test bottle.");
    for (const color of bottle) {
      const colorIndex = COMPACT_COLOR_NAMES.findIndex(
        (candidate) => candidate === color,
      );
      if (color !== "" && colorIndex === -1) {
        throw new Error(`Unknown test color "${color}".`);
      }
      const colorCode = color === "" ? 0 : colorIndex + 1;
      const byte = 1 + Math.floor(slot / 2);
      if (slot % 2 === 0) bytes[byte] = colorCode << 4;
      else bytes[byte] |= colorCode;
      slot++;
    }
  }

  return { bytes, code: encodeBytes(bytes) };
}

function withCssEscape(action: () => void): void {
  const originalCss = globalThis.CSS;
  globalThis.CSS = { escape: (value: string) => value } as typeof CSS;
  try {
    action();
  } finally {
    globalThis.CSS = originalCss;
  }
}

function createFixture(options: FixtureOptions = {}) {
  const checkboxes = DEFAULT_COLORS.map((value) => ({
    value,
    checked: value === "Red" || value === "Blue",
  }));
  const elements = {
    numBottles: { value: "4" },
    colorChecklist: {
      querySelectorAll(selector: string) {
        if (selector === 'input[type="checkbox"]') return checkboxes;
        return [];
      },
      querySelector(selector: string) {
        const value = selector.match(/value="(.+)"/)?.[1];
        return checkboxes.find((checkbox) => checkbox.value === value) ?? null;
      },
    },
    ioArea: { hidden: true },
    ioLabel: { textContent: "Puzzle code" },
    ioMsg: { textContent: "" },
    ioText: {
      value: "",
      focused: false,
      selected: false,
      focus() {
        this.focused = true;
      },
      select() {
        this.selected = true;
      },
      setSelectionRange() {},
    },
    ioApplyBtn: { dataset: { mode: "" } },
    toast: { textContent: "", dataset: { tone: "" }, hidden: true },
  };
  const originalLayers = [
    ["", "", "Red", "Red"],
    ["Red", "Red", "Blue", "Blue"],
    ["", "", "Blue", "Blue"],
    ["", "", "", ""],
  ];
  const state = {
    bottleLayers: originalLayers.map((row) => row.slice()),
    selectedLayer: 2,
    openPopoverBottle: 1,
    inputHistory: ["change"],
  };
  const calls: Array<[string, string?]> = [];
  const io = createImportExport({
    CAP,
    DEFAULT_COLORS,
    state,
    el: (id: string) => elements[id as keyof typeof elements],
    showError: (message: string) => calls.push(["error", message]),
    selectedColors: () =>
      checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    updateSelectAllVisibility: () => calls.push(["select-all"]),
    updateColorLimitUI: () => calls.push(["color-limit"]),
    buildBottlesUI: () => calls.push(["build"]),
    closeAllPopovers: () => calls.push(["close"]),
    renderAllLayers: () => calls.push(["layers"]),
    renderPalette: () => calls.push(["palette"]),
    runContinuousValidation: () => calls.push(["validation"]),
    updateSolveEnabled: () => calls.push(["solve-enabled"]),
    validateCurrentInput: () => options.validationError ?? null,
    clipboard: options.clipboard,
    copyCommand: options.copyCommand,
    currentUrl: () => "https://chromaflow.example/solver?theme=dark#editor",
    showSuccess: (message: string) => calls.push(["success", message]),
  } as unknown as Parameters<typeof createImportExport>[0]);

  return { calls, checkboxes, elements, io, originalLayers, state };
}

test("compact exported puzzle codes are copied and round-trip through the import workflow", async () => {
  const originalCss = globalThis.CSS;
  globalThis.CSS = { escape: (value: string) => value } as typeof CSS;

  try {
    const copied: string[] = [];
    const { checkboxes, elements, io, originalLayers, state } = createFixture({
      clipboard: {
        writeText: (value) => {
          copied.push(value);
          return Promise.resolve();
        },
      },
    });
    await io.onExport();
    const exportedCode = elements.ioText.value;

    expect(exportedCode).toMatch(/^WS1:/);
    expect(exportedCode).toBe(encodeCompactPuzzle(originalLayers).code);
    expect(copied).toEqual([exportedCode]);
    expect(elements.ioArea.hidden).toBe(false);
    expect(elements.ioMsg.textContent).toBe("Export copied to clipboard.");
    expect(elements.toast.textContent).toBe("Puzzle copied to clipboard");
    expect(elements.toast.hidden).toBe(false);

    state.bottleLayers = [];
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = exportedCode;
    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe("Imported successfully.");
    expect(state.bottleLayers).toEqual(originalLayers);
    expect(
      checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    ).toEqual(["Red", "Blue"]);
    expect(state.selectedLayer).toBeNull();
    expect(state.openPopoverBottle).toBeNull();
    expect(state.inputHistory).toEqual([]);
  } finally {
    globalThis.CSS = originalCss;
  }
});

test("exports the stored five-bottle puzzle with the reference compact encoding", async () => {
  const { elements, io, state } = createFixture({
    clipboard: { writeText: () => Promise.resolve() },
  });
  elements.numBottles.value = "5";
  state.bottleLayers = [
    ["Blue", "Red", "Orange", "Blue"],
    ["Blue", "Red", "Orange", "Orange"],
    ["Red", "Orange", "Blue", "Red"],
    ["", "", "", ""],
    ["", "", "", ""],
  ];

  await io.onExport();

  expect(elements.ioText.value).toBe("WS1:FYE4gTMTgQAAAAA=");
});

test("exports a 14-bottle puzzle as a 29-byte compact payload", async () => {
  const { elements, io, state } = createFixture({
    clipboard: { writeText: () => Promise.resolve() },
  });
  elements.numBottles.value = "14";
  state.bottleLayers = [
    ...COMPACT_COLOR_NAMES.map(filledBottle),
    filledBottle(),
    filledBottle(),
  ];

  await io.onExport();

  const binary = atob(elements.ioText.value.slice(4));
  expect(binary).toHaveLength(29);
  expect(binary.charCodeAt(0)).toBe(0x1e);
});

describe("shared puzzle URLs", () => {
  test("copies a compact URL-safe puzzle link while preserving other query parameters", async () => {
    const copied: string[] = [];
    const { elements, io } = createFixture({
      clipboard: {
        writeText: (value) => {
          copied.push(value);
          return Promise.resolve();
        },
      },
    });

    await io.onShare();

    const shareUrl = new URL(elements.ioText.value);
    expect(shareUrl.origin + shareUrl.pathname).toBe(
      "https://chromaflow.example/solver",
    );
    expect(shareUrl.searchParams.get("theme")).toBe("dark");
    expect(shareUrl.searchParams.get("p")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(shareUrl.hash).toBe("");
    expect(copied).toEqual([shareUrl.toString()]);
    expect(elements.ioLabel.textContent).toBe("Share URL");
    expect(elements.ioMsg.textContent).toBe("Share URL copied to clipboard.");
  });

  test("restores a valid shared puzzle through the existing import path", () => {
    const { calls, io, originalLayers, state } = createFixture();
    state.bottleLayers = [];
    const code = encodeCompactPuzzle(originalLayers).code;
    const payload = code
      .slice(4)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");

    withCssEscape(() => {
      expect(
        io.importSharedPuzzle(`https://chromaflow.example/?p=${payload}`),
      ).toBe(true);
    });

    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).toContainEqual([
      "success",
      "Shared puzzle loaded. Review it, then solve.",
    ]);
  });

  test("rejects an invalid link without changing the puzzle", () => {
    const { calls, io, originalLayers, state } = createFixture();

    expect(
      io.importSharedPuzzle("https://chromaflow.example/?p=not!safe"),
    ).toBe(true);

    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).toContainEqual([
      "error",
      "Invalid shared puzzle link: Invalid shared puzzle payload.",
    ]);
  });

  test("does not share a puzzle that fails current validation", async () => {
    const copied: string[] = [];
    const { calls, elements, io } = createFixture({
      clipboard: {
        writeText: (value) => {
          copied.push(value);
          return Promise.resolve();
        },
      },
      validationError:
        'Color "Red" appears 3 times, but must appear exactly 4 times.',
    });

    await io.onShare();

    expect(copied).toEqual([]);
    expect(elements.ioArea.hidden).toBe(true);
    expect(calls).toContainEqual([
      "error",
      'Cannot share this puzzle: Color "Red" appears 3 times, but must appear exactly 4 times.',
    ]);
  });
});

test("continues importing legacy JSON saved-puzzle strings", () => {
  const layers = [
    ["", "", "Red", "Red"],
    ["Red", "Red", "Blue", "Blue"],
    ["", "", "Blue", "Blue"],
    ["", "", "", ""],
  ];
  const code = encodePayload({
    v: 1,
    n: 4,
    colors: ["Red", "Blue"],
    layers,
  });
  const { elements, io, state } = createFixture();

  withCssEscape(() => {
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = code;
    io.onIOApply();
  });

  expect(elements.ioMsg.textContent).toBe("Imported successfully.");
  expect(state.bottleLayers).toEqual(layers);
});

describe("compact puzzle imports", () => {
  test("imports compact layers in top-to-bottom builder order", () => {
    const layers = [
      ["", "", "Red", "Blue"],
      ["Red", "Blue", "Red", "Blue"],
      ["", "", "Red", "Blue"],
      ["", "", "", ""],
    ];
    const { code } = encodeCompactPuzzle(layers);
    const { checkboxes, elements, io, state } = createFixture();

    withCssEscape(() => {
      elements.ioApplyBtn.dataset.mode = "import";
      elements.ioText.value = code;
      io.onIOApply();
    });

    expect(elements.ioMsg.textContent).toBe("Imported successfully.");
    expect(state.bottleLayers).toEqual(layers);
    expect(
      checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    ).toEqual(["Red", "Blue"]);
  });

  test("preserves empty helper bottles", () => {
    const layers = [
      filledBottle("Red"),
      filledBottle("Blue"),
      filledBottle(),
      filledBottle(),
    ];
    const { code } = encodeCompactPuzzle(layers);
    const { elements, io, state } = createFixture();

    withCssEscape(() => {
      elements.ioApplyBtn.dataset.mode = "import";
      elements.ioText.value = code;
      io.onIOApply();
    });

    expect(elements.ioMsg.textContent).toBe("Imported successfully.");
    expect(state.bottleLayers.slice(-2)).toEqual([
      ["", "", "", ""],
      ["", "", "", ""],
    ]);
  });

  test("imports an 11-bottle compact puzzle", () => {
    const colors = COMPACT_COLOR_NAMES.slice(0, 9);
    const layers = [
      ...colors.map(filledBottle),
      filledBottle(),
      filledBottle(),
    ];
    const { bytes, code } = encodeCompactPuzzle(layers);
    const { checkboxes, elements, io, state } = createFixture();

    withCssEscape(() => {
      elements.ioApplyBtn.dataset.mode = "import";
      elements.ioText.value = code;
      io.onIOApply();
    });

    expect(bytes).toHaveLength(23);
    expect(elements.numBottles.value).toBe("11");
    expect(state.bottleLayers).toEqual(layers);
    expect(checkboxes.filter((checkbox) => checkbox.checked)).toHaveLength(9);
  });

  test("imports a 14-bottle, 29-byte compact puzzle", () => {
    const layers = [
      ...COMPACT_COLOR_NAMES.map(filledBottle),
      filledBottle(),
      filledBottle(),
    ];
    const { bytes, code } = encodeCompactPuzzle(layers);
    const { checkboxes, elements, io, state } = createFixture();

    withCssEscape(() => {
      elements.ioApplyBtn.dataset.mode = "import";
      elements.ioText.value = code;
      io.onIOApply();
    });

    expect(bytes).toHaveLength(29);
    expect(elements.numBottles.value).toBe("14");
    expect(state.bottleLayers).toEqual(layers);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
  });
});

describe("export falls back to textarea copying and gives manual guidance when copying fails", () => {
  test("uses the selected textarea fallback", async () => {
    const { elements, io } = createFixture({
      clipboard: { writeText: async () => Promise.reject(new Error("Denied")) },
      copyCommand: () => true,
    });

    await io.onExport();

    expect(elements.ioText.focused).toBe(true);
    expect(elements.ioText.selected).toBe(true);
    expect(elements.ioMsg.textContent).toBe("Export copied to clipboard.");
  });

  test("keeps the code selected when all copy methods fail", async () => {
    const { elements, io } = createFixture({
      clipboard: {
        writeText: async () => Promise.reject(new Error("Denied")),
      },
      copyCommand: () => false,
    });

    await io.onExport();

    expect(elements.ioText.selected).toBe(true);
    expect(elements.ioMsg.textContent).toBe(
      "Automatic copy failed. Copy the selected code manually.",
    );
    expect(elements.toast.textContent).toBe("Could not copy automatically");
    expect(elements.toast.dataset.tone).toBe("warning");
  });
});

describe("import reports invalid codes without changing the puzzle", () => {
  test("rejects a missing version prefix", () => {
    const { elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = "not-a-code";

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Invalid code (missing WS1: prefix).",
    );
    expect(state.bottleLayers).toEqual(originalLayers);
  });

  test("rejects malformed base64 JSON", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = "WS1:not-json";

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Invalid code payload.",
    );
  });

  test("rejects unsupported payload versions", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodePayload({ v: 2 });

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Unsupported version.",
    );
  });

  test("rejects an unsupported compact version without changing the puzzle", () => {
    const layers = [
      filledBottle("Red"),
      filledBottle("Blue"),
      filledBottle(),
      filledBottle(),
    ];
    const { code } = encodeCompactPuzzle(layers, 2);
    const { calls, elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = code;

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Unsupported compact puzzle version 2.",
    );
    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).not.toContainEqual(["build"]);
  });

  test("rejects an invalid compact bottle count without changing the puzzle", () => {
    const bytes = new Uint8Array(7);
    bytes[0] = 0x13;
    const { calls, elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodeBytes(bytes);

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Invalid compact puzzle bottle count 3; expected 4 to 14.",
    );
    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).not.toContainEqual(["build"]);
  });

  test("rejects an invalid compact length without changing the puzzle", () => {
    const layers = [
      filledBottle("Red"),
      filledBottle("Blue"),
      filledBottle(),
      filledBottle(),
    ];
    const { bytes } = encodeCompactPuzzle(layers);
    const { calls, elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodeBytes(bytes.slice(0, -1));

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Invalid compact puzzle length: expected 9 bytes for 4 bottles, received 8.",
    );
    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).not.toContainEqual(["build"]);
  });

  test("rejects an invalid compact color code without changing the puzzle", () => {
    const layers = [
      filledBottle("Red"),
      filledBottle("Blue"),
      filledBottle(),
      filledBottle(),
    ];
    const { bytes } = encodeCompactPuzzle(layers);
    bytes[1] = 0xd1;
    const { calls, elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodeBytes(bytes);

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Invalid compact puzzle color code 13 at bottle 1, layer 1.",
    );
    expect(state.bottleLayers).toEqual(originalLayers);
    expect(calls).not.toContainEqual(["build"]);
  });

  test("rejects color counts that do not match the bottle configuration", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodePayload({
      v: 1,
      n: 4,
      colors: ["Red", "Blue", "Green"],
      layers: Array.from({ length: 4 }, () => filledBottle()),
    });

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Import must include exactly 2 colors for 4 bottles.",
    );
  });
});
