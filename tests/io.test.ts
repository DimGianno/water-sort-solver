import { describe, expect, test } from "vitest";

import { CAP, DEFAULT_COLORS } from "../assets/js/constants.ts";
import { createImportExport } from "../assets/js/io.ts";

interface FixtureOptions {
  clipboard?: { writeText: (value: string) => Promise<void> };
  copyCommand?: (command: string) => boolean;
}

function encodePayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `WS1:${btoa(binary)}`;
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
    ["Blue", "Blue", "Red", "Red"],
    ["Red", "Red", "Blue", "Blue"],
    ["", "", "", ""],
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
    clipboard: options.clipboard,
    copyCommand: options.copyCommand,
  } as unknown as Parameters<typeof createImportExport>[0]);

  return { calls, checkboxes, elements, io, originalLayers, state };
}

test("exported puzzle codes are copied and round-trip through the import workflow", async () => {
  const originalCss = globalThis.CSS;
  globalThis.CSS = { escape: (value: string) => value } as typeof CSS;

  try {
    const copied: string[] = [];
    const { checkboxes, elements, io, originalLayers, state } = createFixture({
      clipboard: {
        writeText: async (value) => {
          copied.push(value);
        },
      },
    });
    await io.onExport();
    const exportedCode = elements.ioText.value;

    expect(exportedCode).toMatch(/^WS1:/);
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

  test("rejects colors that exceed bottle capacity", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodePayload({
      v: 1,
      n: 4,
      colors: ["Red", "Blue", "Green"],
      layers: Array.from({ length: 4 }, () => Array(CAP).fill("")),
    });

    io.onIOApply();

    expect(elements.ioMsg.textContent).toBe(
      "Import failed: Too many colors in import for 4 bottles (max 2).",
    );
  });
});
