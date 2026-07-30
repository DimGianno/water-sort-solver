import type { AppState, ElementLookup } from "./app-types.ts";

interface ImportExportContext {
  CAP: number;
  DEFAULT_COLORS: readonly string[];
  state: AppState;
  el: ElementLookup;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  selectedColors: () => string[];
  updateSelectAllVisibility: () => void;
  updateColorLimitUI: () => void;
  buildBottlesUI: () => void;
  closeAllPopovers: () => void;
  renderAllLayers: () => void;
  renderPalette: () => void;
  runContinuousValidation: () => void;
  updateSolveEnabled: () => void;
  validateCurrentInput: () => string | null;
  clipboard?: Pick<Clipboard, "writeText">;
  copyCommand?: (command: string) => boolean;
  currentUrl?: () => string;
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

const COMPACT_CODEC_VERSION = 1;
const MIN_BOTTLES = 4;
const MAX_BOTTLES = 14;
const SHARE_PARAM = "p";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error.";
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
    const n = parseInt(el<HTMLSelectElement>("numBottles").value, 10);
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
    const bottleCount = obj.layers.length;
    if (bottleCount < MIN_BOTTLES || bottleCount > MAX_BOTTLES) {
      throw new Error(
        `Cannot export ${bottleCount} bottles; expected ${MIN_BOTTLES} to ${MAX_BOTTLES}.`,
      );
    }
    if (obj.n !== bottleCount) {
      throw new Error("Cannot export a mismatched bottle count.");
    }

    const bytes = new Uint8Array(1 + bottleCount * 2);
    bytes[0] = (COMPACT_CODEC_VERSION << 4) | bottleCount;
    let slot = 0;

    for (let bottle = 0; bottle < bottleCount; bottle++) {
      const layers = obj.layers[bottle];
      if (layers.length !== CAP) {
        throw new Error(
          `Cannot export bottle ${bottle + 1}; expected ${CAP} layer slots.`,
        );
      }

      for (const color of layers) {
        const colorIndex = COMPACT_COLOR_NAMES.findIndex(
          (candidate) => candidate === color,
        );
        if (color !== "" && colorIndex === -1) {
          throw new Error(`Cannot export unknown color "${color}".`);
        }

        const colorCode = color === "" ? 0 : colorIndex + 1;
        const byte = 1 + Math.floor(slot / 2);
        if (slot % 2 === 0) bytes[byte] = colorCode << 4;
        else bytes[byte] |= colorCode;
        slot++;
      }
    }

    return "WS1:" + bytesToBase64(bytes);
  }

  function tryDecodeLegacyImport(
    bytes: Uint8Array,
  ): Record<string, unknown> | null {
    let obj: unknown;
    try {
      const json = new TextDecoder().decode(bytes);
      obj = JSON.parse(json);
    } catch {
      return null;
    }
    if (!isRecord(obj) || obj.v !== 1) throw new Error("Unsupported version.");
    return obj;
  }

  function decodeCompactImport(bytes: Uint8Array): ExportPayload {
    if (bytes.length < 1) throw new Error("Compact puzzle payload is empty.");

    const version = bytes[0] >> 4;
    const bottleCount = bytes[0] & 0x0f;
    if (version !== COMPACT_CODEC_VERSION) {
      throw new Error(`Unsupported compact puzzle version ${version}.`);
    }
    if (bottleCount < MIN_BOTTLES || bottleCount > MAX_BOTTLES) {
      throw new Error(
        `Invalid compact puzzle bottle count ${bottleCount}; expected ${MIN_BOTTLES} to ${MAX_BOTTLES}.`,
      );
    }

    const expectedLength = 1 + bottleCount * 2;
    if (bytes.length !== expectedLength) {
      throw new Error(
        `Invalid compact puzzle length: expected ${expectedLength} bytes for ${bottleCount} bottles, received ${bytes.length}.`,
      );
    }

    const layers = Array.from({ length: bottleCount }, () =>
      Array<string>(CAP).fill(""),
    );
    const usedColors = new Set<string>();

    for (let slot = 0; slot < bottleCount * CAP; slot++) {
      const byte = bytes[1 + Math.floor(slot / 2)];
      const colorCode = slot % 2 === 0 ? byte >> 4 : byte & 0x0f;
      if (colorCode > COMPACT_COLOR_NAMES.length) {
        const bottle = Math.floor(slot / CAP);
        const layer = slot % CAP;
        throw new Error(
          `Invalid compact puzzle color code ${colorCode} at bottle ${bottle + 1}, layer ${layer + 1}.`,
        );
      }

      const color = colorCode === 0 ? "" : COMPACT_COLOR_NAMES[colorCode - 1];
      layers[Math.floor(slot / CAP)][slot % CAP] = color;
      if (color) usedColors.add(color);
    }

    return {
      v: 1,
      n: bottleCount,
      colors: DEFAULT_COLORS.filter((color) => usedColors.has(color)),
      layers,
    };
  }

  function decodeImport(code: string): unknown {
    const trimmed = (code || "").trim();
    if (!trimmed.startsWith("WS1:"))
      throw new Error("Invalid code (missing WS1: prefix).");

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(trimmed.slice(4));
    } catch {
      throw new Error("Invalid code payload.");
    }

    const legacy = tryDecodeLegacyImport(bytes);
    if (legacy) return legacy;

    const version = bytes.length ? bytes[0] >> 4 : -1;
    const bottleCount = bytes.length ? bytes[0] & 0x0f : -1;
    const expectedLength = 1 + bottleCount * 2;
    const looksCompact =
      version === COMPACT_CODEC_VERSION ||
      (bottleCount >= MIN_BOTTLES &&
        bottleCount <= MAX_BOTTLES &&
        bytes.length === expectedLength);
    if (!looksCompact) throw new Error("Invalid code payload.");

    return decodeCompactImport(bytes);
  }

  function showIO(mode: "export" | "import" | "share"): void {
    el("ioArea").hidden = false;
    el("ioMsg").textContent = "";
    el<HTMLTextAreaElement>("ioText").value = "";
    el("ioApplyBtn").dataset.mode = mode;
    el("ioLabel").textContent = mode === "share" ? "Share URL" : "Puzzle code";
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

    if (!isUnknownArray(obj.layers) || obj.layers.length !== n)
      throw new Error("Invalid layers in payload.");

    const cleanLayers: string[][] = [];
    for (let b = 0; b < n; b++) {
      const row = obj.layers[b];
      if (!isUnknownArray(row) || row.length !== CAP) {
        throw new Error("Invalid layers in payload.");
      }
      const cleanRow: string[] = [];
      for (let l = 0; l < CAP; l++) {
        const value = row[l] || "";
        if (typeof value !== "string") {
          throw new Error("Invalid layer color in payload.");
        }
        if (value !== "" && !want.includes(value)) {
          throw new Error(`Invalid layer color "${value}" in payload.`);
        }
        cleanRow.push(value);
      }
      cleanLayers.push(cleanRow);
    }

    return { n, want, cleanLayers };
  }

  function applyImport(obj: unknown): void {
    const parsed = normalizeImport(obj);

    el<HTMLSelectElement>("numBottles").value = String(parsed.n);
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

  function importCode(code: string): void {
    applyImport(decodeImport(code));
  }

  async function copyText(text: string): Promise<boolean> {
    try {
      const clipboard = ctx.clipboard ?? globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API unavailable.");
      await clipboard.writeText(text);
      return true;
    } catch {
      const textArea = el<HTMLTextAreaElement>("ioText");
      textArea.focus?.();
      textArea.select?.();
      textArea.setSelectionRange?.(0, text.length);
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
    const copied = await copyText(code);
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

  function toBase64Url(code: string): string {
    return code
      .slice(4)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
  }

  function fromBase64Url(payload: string): string {
    if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) {
      throw new Error("Invalid shared puzzle payload.");
    }
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    return `WS1:${base64}${padding}`;
  }

  function createShareUrl(): string {
    const code = encodeExport(toExportPayload());
    const currentUrl = ctx.currentUrl?.() ?? globalThis.location.href;
    const url = new URL(currentUrl);
    url.searchParams.set(SHARE_PARAM, toBase64Url(code));
    url.hash = "";
    return url.toString();
  }

  async function onShare(): Promise<void> {
    if (!state.bottleLayers.length) {
      showError("Build bottles UI first.");
      return;
    }
    const validationError = ctx.validateCurrentInput();
    if (validationError) {
      showError(`Cannot share this puzzle: ${validationError}`);
      return;
    }

    const shareUrl = createShareUrl();
    showIO("share");
    el<HTMLTextAreaElement>("ioText").value = shareUrl;
    const copied = await copyText(shareUrl);
    if (copied) {
      el("ioMsg").textContent = "Share URL copied to clipboard.";
      showToast("Share URL copied to clipboard");
    } else {
      el("ioMsg").textContent =
        "Automatic copy failed. Copy the selected URL manually.";
      showToast("Could not copy automatically", "warning");
    }
  }

  function importSharedPuzzle(currentUrl: string): boolean {
    const url = new URL(currentUrl);
    if (!url.searchParams.has(SHARE_PARAM)) return false;

    try {
      importCode(fromBase64Url(url.searchParams.get(SHARE_PARAM) ?? ""));
      ctx.showSuccess("Shared puzzle loaded. Review it, then solve.");
      showToast("Shared puzzle loaded");
    } catch (error) {
      showError(`Invalid shared puzzle link: ${getErrorMessage(error)}`);
      showToast("Could not load shared puzzle", "warning");
    }
    return true;
  }

  function onIOApply(): void {
    const mode = el("ioApplyBtn").dataset.mode || "import";
    if (mode === "export" || mode === "share") {
      el("ioMsg").textContent =
        mode === "share" ? "Copy the URL above." : "Copy the code above.";
      return;
    }
    try {
      const code = el<HTMLTextAreaElement>("ioText").value;
      importCode(code);
      el("ioMsg").textContent = "Imported successfully.";
    } catch (error) {
      el("ioMsg").textContent = "Import failed: " + getErrorMessage(error);
    }
  }

  return {
    applyImport,
    importCode,
    showIO,
    hideIO,
    onExport,
    onShare,
    onImport,
    onIOApply,
    importSharedPuzzle,
  };
}
