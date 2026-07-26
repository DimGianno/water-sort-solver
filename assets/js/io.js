export function createImportExport(ctx) {
  const { CAP, DEFAULT_COLORS, state, el } = ctx;
  const {
    showError,
    selectedColors,
    updateSelectAllVisibility,
    updateColorLimitUI,
    buildBottlesUI,
  } = ctx;
  const {
    closeAllPopovers,
    renderAllLayers,
    renderPalette,
    runContinuousValidation,
    updateSolveEnabled,
  } = ctx;
  let toastTimer = null;

  function showToast(message, tone = "success") {
    const toast = el("toast");
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
      toastTimer = null;
    }, 2500);
    toastTimer.unref?.();
  }

  function toExportPayload() {
    const n = parseInt(el("numBottles").value, 10);
    const colors = selectedColors();
    const layers = state.bottleLayers.map((arr) => arr.slice());
    return { v: 1, n, colors, layers };
  }

  function bytesToBase64(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function encodeExport(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return "WS1:" + bytesToBase64(bytes);
  }

  function decodeImport(code) {
    const trimmed = (code || "").trim();
    if (!trimmed.startsWith("WS1:"))
      throw new Error("Invalid code (missing WS1: prefix).");
    const b64 = trimmed.slice(4);
    let obj;
    try {
      const bytes = base64ToBytes(b64);
      const json = new TextDecoder().decode(bytes);
      obj = JSON.parse(json);
    } catch {
      throw new Error("Invalid code payload.");
    }
    if (!obj || obj.v !== 1) throw new Error("Unsupported version.");
    return obj;
  }

  function showIO(mode) {
    el("ioArea").hidden = false;
    el("ioMsg").textContent = "";
    el("ioText").value = "";
    el("ioApplyBtn").dataset.mode = mode;
  }

  function hideIO() {
    el("ioArea").hidden = true;
    el("ioMsg").textContent = "";
    el("ioText").value = "";
  }

  function normalizeImport(obj) {
    if (!obj || typeof obj.n !== "number") throw new Error("Invalid payload.");

    const n = Math.max(4, Math.min(14, obj.n | 0));
    const max = n - 2;
    const want = Array.isArray(obj.colors)
      ? obj.colors.filter((c) => DEFAULT_COLORS.includes(c))
      : [];
    if (want.length > max)
      throw new Error(
        `Too many colors in import for ${n} bottles (max ${max}).`,
      );

    if (!Array.isArray(obj.layers) || obj.layers.length !== n)
      throw new Error("Invalid layers in payload.");

    const cleanLayers = [];
    for (let b = 0; b < n; b++) {
      const row = obj.layers[b];
      if (!Array.isArray(row) || row.length !== CAP) {
        throw new Error("Invalid layers in payload.");
      }
      const cleanRow = [];
      for (let l = 0; l < CAP; l++) {
        const v = row[l] || "";
        if (v !== "" && !want.includes(v))
          throw new Error(`Invalid layer color "${v}" in payload.`);
        cleanRow.push(v);
      }
      cleanLayers.push(cleanRow);
    }

    return { n, want, cleanLayers };
  }

  function applyImport(obj) {
    const parsed = normalizeImport(obj);

    el("numBottles").value = parsed.n;
    el("colorChecklist")
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
      });
    for (const c of parsed.want) {
      const cb = el("colorChecklist").querySelector(
        `input[type="checkbox"][value="${CSS.escape(c)}"]`,
      );
      if (cb) cb.checked = true;
    }
    updateSelectAllVisibility();
    updateColorLimitUI();

    buildBottlesUI();
    state.bottleLayers = parsed.cleanLayers.map((x) => x.slice());
    state.selectedLayer = null;
    state.openPopoverBottle = null;
    closeAllPopovers();
    state.inputHistory = [];

    renderAllLayers();
    renderPalette();
    runContinuousValidation();
    updateSolveEnabled();
  }

  async function copyExportCode(code) {
    try {
      const clipboard = ctx.clipboard ?? globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API unavailable.");
      await clipboard.writeText(code);
      return true;
    } catch {
      const textArea = el("ioText");
      textArea.focus?.();
      textArea.select?.();
      textArea.setSelectionRange?.(0, code.length);
      try {
        const copyCommand =
          ctx.copyCommand ??
          ((command) => globalThis.document?.execCommand?.(command));
        return copyCommand("copy") === true;
      } catch {
        return false;
      }
    }
  }

  async function onExport() {
    if (!state.bottleLayers.length) return showError("Build bottles UI first.");
    const payload = toExportPayload();
    const code = encodeExport(payload);
    showIO("export");
    el("ioText").value = code;
    const copied = await copyExportCode(code);
    if (copied) {
      el("ioMsg").textContent = "Export copied to clipboard.";
      showToast("Puzzle copied to clipboard");
    } else {
      el("ioMsg").textContent =
        "Automatic copy failed. Copy the selected code manually.";
      showToast("Could not copy automatically", "warning");
    }
  }

  function onImport() {
    showIO("import");
    el("ioText").value = "";
    el("ioMsg").textContent = "Paste code and press Apply.";
  }

  function onIOApply() {
    const mode = el("ioApplyBtn").dataset.mode || "import";
    if (mode === "export") {
      el("ioMsg").textContent = "Copy the code above.";
      return;
    }
    try {
      const code = el("ioText").value;
      const obj = decodeImport(code);
      applyImport(obj);
      el("ioMsg").textContent = "Imported successfully.";
    } catch (e) {
      el("ioMsg").textContent = "Import failed: " + (e?.message || String(e));
    }
  }

  return {
    showIO,
    hideIO,
    onExport,
    onImport,
    onIOApply,
  };
}
