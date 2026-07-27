import type { AppState, ElementLookup } from "./app-types.ts";

interface ImportExportContext {
  CAP: number;
  DEFAULT_COLORS: readonly string[];
  state: AppState;
  el: ElementLookup;
  showError: (message: string) => void;
  selectedColors: () => string[];
  updateSelectAllVisibility: () => void;
  updateColorLimitUI: () => void;
  buildBottlesUI: () => void;
  closeAllPopovers: () => void;
  renderAllLayers: () => void;
  renderPalette: () => void;
  runContinuousValidation: () => void;
  updateSolveEnabled: () => void;
  clipboard?: Pick<Clipboard, "writeText">;
  copyCommand?: (command: string) => boolean;
}

interface ExportPayload {
  v: 1;
  n: number;
  colors: string[];
  layers: string[][];
}

interface NormalizedImport {
  n: number;
  want: string[];
  cleanLayers: string[][];
}

type ToastTone = "success" | "warning";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (message) return String(message);
  }
  return String(error);
}

export function createImportExport(ctx: ImportExportContext) {
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
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, tone: ToastTone = "success"): void {
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
    (
      toastTimer as ReturnType<typeof setTimeout> & { unref?: () => void }
    ).unref?.();
  }

  function toExportPayload(): ExportPayload {
    const n = parseInt(el<HTMLInputElement>("numBottles").value, 10);
    const colors = selectedColors();
    const layers = state.bottleLayers.map((arr) => arr.slice());
    return { v: 1, n, colors, layers };
  }

  function bytesToBase64(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function encodeExport(obj: ExportPayload): string {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return "WS1:" + bytesToBase64(bytes);
  }

  function decodeImport(code: string): Record<string, unknown> {
    const trimmed = (code || "").trim();
    if (!trimmed.startsWith("WS1:"))
      throw new Error("Invalid code (missing WS1: prefix).");
    const b64 = trimmed.slice(4);
    let obj: unknown;
    try {
      const bytes = base64ToBytes(b64);
      const json = new TextDecoder().decode(bytes);
      obj = JSON.parse(json);
    } catch {
      throw new Error("Invalid code payload.");
    }
    if (!isRecord(obj) || obj.v !== 1) throw new Error("Unsupported version.");
    return obj;
  }

  function showIO(mode: "export" | "import"): void {
    el("ioArea").hidden = false;
    el("ioMsg").textContent = "";
    el<HTMLTextAreaElement>("ioText").value = "";
    el("ioApplyBtn").dataset.mode = mode;
  }

  function hideIO(): void {
    el("ioArea").hidden = true;
    el("ioMsg").textContent = "";
    el<HTMLTextAreaElement>("ioText").value = "";
  }

  function normalizeImport(obj: unknown): NormalizedImport {
    if (!isRecord(obj) || typeof obj.n !== "number")
      throw new Error("Invalid payload.");

    const n = Math.max(4, Math.min(14, obj.n | 0));
    const max = n - 2;
    const want = Array.isArray(obj.colors)
      ? obj.colors.filter(
          (color): color is string =>
            typeof color === "string" && DEFAULT_COLORS.includes(color),
        )
      : [];
    if (want.length !== max)
      throw new Error(
        `Import must include exactly ${max} colors for ${n} bottles.`,
      );

    if (!Array.isArray(obj.layers) || obj.layers.length !== n)
      throw new Error("Invalid layers in payload.");

    const cleanLayers: string[][] = [];
    for (let b = 0; b < n; b++) {
      const row = obj.layers[b];
      if (!Array.isArray(row) || row.length !== CAP) {
        throw new Error("Invalid layers in payload.");
      }
      const cleanRow: string[] = [];
      for (let l = 0; l < CAP; l++) {
        const v: unknown = row[l] || "";
        if (typeof v !== "string" || (v !== "" && !want.includes(v)))
          throw new Error(`Invalid layer color "${v}" in payload.`);
        cleanRow.push(v);
      }
      cleanLayers.push(cleanRow);
    }

    return { n, want, cleanLayers };
  }

  function applyImport(obj: unknown): void {
    const parsed = normalizeImport(obj);

    el<HTMLInputElement>("numBottles").value = String(parsed.n);
    el("colorChecklist")
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
      });
    for (const c of parsed.want) {
      const cb = el("colorChecklist").querySelector<HTMLInputElement>(
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

  async function copyExportCode(code: string): Promise<boolean> {
    try {
      const clipboard = ctx.clipboard ?? globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API unavailable.");
      await clipboard.writeText(code);
      return true;
    } catch {
      const textArea = el<HTMLTextAreaElement>("ioText");
      textArea.focus?.();
      textArea.select?.();
      textArea.setSelectionRange?.(0, code.length);
      try {
        const copyCommand =
          ctx.copyCommand ??
          ((command: string) => globalThis.document?.execCommand?.(command));
        return copyCommand("copy") === true;
      } catch {
        return false;
      }
    }
  }

  async function onExport(): Promise<void> {
    if (!state.bottleLayers.length) return showError("Build bottles UI first.");
    const payload = toExportPayload();
    const code = encodeExport(payload);
    showIO("export");
    el<HTMLTextAreaElement>("ioText").value = code;
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

  function onImport(): void {
    showIO("import");
    el<HTMLTextAreaElement>("ioText").value = "";
    el("ioMsg").textContent = "Paste code and press Apply.";
  }

  function onIOApply(): void {
    const mode = el("ioApplyBtn").dataset.mode || "import";
    if (mode === "export") {
      el("ioMsg").textContent = "Copy the code above.";
      return;
    }
    try {
      const code = el<HTMLTextAreaElement>("ioText").value;
      const obj = decodeImport(code);
      applyImport(obj);
      el("ioMsg").textContent = "Imported successfully.";
    } catch (error) {
      el("ioMsg").textContent = "Import failed: " + getErrorMessage(error);
    }
  }

  return {
    applyImport,
    showIO,
    hideIO,
    onExport,
    onImport,
    onIOApply,
  };
}
