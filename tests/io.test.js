import assert from "node:assert/strict";
import test from "node:test";

import { CAP, DEFAULT_COLORS } from "../assets/js/constants.ts";
import { createImportExport } from "../assets/js/io.js";

function encodePayload(payload) {
  return `WS1:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

function createFixture(options = {}) {
  const checkboxes = DEFAULT_COLORS.map((value) => ({
    value,
    checked: value === "Red" || value === "Blue",
  }));
  const elements = {
    numBottles: { value: "4" },
    colorChecklist: {
      querySelectorAll(selector) {
        if (selector === 'input[type="checkbox"]') return checkboxes;
        return [];
      },
      querySelector(selector) {
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
    ioApplyBtn: { dataset: {} },
    toast: { textContent: "", dataset: {}, hidden: true },
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
  const calls = [];
  const io = createImportExport({
    CAP,
    DEFAULT_COLORS,
    state,
    el: (id) => elements[id],
    showError: (message) => calls.push(["error", message]),
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
  });

  return { calls, checkboxes, elements, io, originalLayers, state };
}

test("exported puzzle codes are copied and round-trip through the import workflow", async () => {
  const originalCss = globalThis.CSS;
  globalThis.CSS = { escape: (value) => value };

  try {
    const copied = [];
    const { checkboxes, elements, io, originalLayers, state } = createFixture({
      clipboard: { writeText: async (value) => copied.push(value) },
    });
    await io.onExport();
    const exportedCode = elements.ioText.value;

    assert.match(exportedCode, /^WS1:/);
    assert.deepEqual(copied, [exportedCode]);
    assert.equal(elements.ioArea.hidden, false);
    assert.equal(elements.ioMsg.textContent, "Export copied to clipboard.");
    assert.equal(elements.toast.textContent, "Puzzle copied to clipboard");
    assert.equal(elements.toast.hidden, false);

    state.bottleLayers = [];
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = exportedCode;
    io.onIOApply();

    assert.equal(elements.ioMsg.textContent, "Imported successfully.");
    assert.deepEqual(state.bottleLayers, originalLayers);
    assert.deepEqual(
      checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
      ["Red", "Blue"],
    );
    assert.equal(state.selectedLayer, null);
    assert.equal(state.openPopoverBottle, null);
    assert.deepEqual(state.inputHistory, []);
  } finally {
    globalThis.CSS = originalCss;
  }
});

test("export falls back to textarea copying and gives manual guidance when copying fails", async (t) => {
  await t.test("uses the selected textarea fallback", async () => {
    const { elements, io } = createFixture({
      clipboard: { writeText: async () => Promise.reject(new Error("Denied")) },
      copyCommand: () => true,
    });

    await io.onExport();

    assert.equal(elements.ioText.focused, true);
    assert.equal(elements.ioText.selected, true);
    assert.equal(elements.ioMsg.textContent, "Export copied to clipboard.");
  });

  await t.test(
    "keeps the code selected when all copy methods fail",
    async () => {
      const { elements, io } = createFixture({
        clipboard: {
          writeText: async () => Promise.reject(new Error("Denied")),
        },
        copyCommand: () => false,
      });

      await io.onExport();

      assert.equal(elements.ioText.selected, true);
      assert.equal(
        elements.ioMsg.textContent,
        "Automatic copy failed. Copy the selected code manually.",
      );
      assert.equal(elements.toast.textContent, "Could not copy automatically");
      assert.equal(elements.toast.dataset.tone, "warning");
    },
  );
});

test("import reports invalid codes without changing the puzzle", async (t) => {
  await t.test("rejects a missing version prefix", () => {
    const { elements, io, originalLayers, state } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = "not-a-code";

    io.onIOApply();

    assert.equal(
      elements.ioMsg.textContent,
      "Import failed: Invalid code (missing WS1: prefix).",
    );
    assert.deepEqual(state.bottleLayers, originalLayers);
  });

  await t.test("rejects malformed base64 JSON", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = "WS1:not-json";

    io.onIOApply();

    assert.equal(
      elements.ioMsg.textContent,
      "Import failed: Invalid code payload.",
    );
  });

  await t.test("rejects unsupported payload versions", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodePayload({ v: 2 });

    io.onIOApply();

    assert.equal(
      elements.ioMsg.textContent,
      "Import failed: Unsupported version.",
    );
  });

  await t.test("rejects colors that exceed bottle capacity", () => {
    const { elements, io } = createFixture();
    elements.ioApplyBtn.dataset.mode = "import";
    elements.ioText.value = encodePayload({
      v: 1,
      n: 4,
      colors: ["Red", "Blue", "Green"],
      layers: Array.from({ length: 4 }, () => Array(CAP).fill("")),
    });

    io.onIOApply();

    assert.equal(
      elements.ioMsg.textContent,
      "Import failed: Too many colors in import for 4 bottles (max 2).",
    );
  });
});
