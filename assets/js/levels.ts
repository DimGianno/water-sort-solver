import type { ElementLookup } from "./app-types.ts";

export interface KnownLevel {
  level: number;
  code: string;
  updatedAt?: string;
}

interface KnownLevelsContext {
  el: ElementLookup;
  importCode: (code: string) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  fetcher?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseKnownLevels(payload: unknown): KnownLevel[] {
  if (!isRecord(payload) || !Array.isArray(payload.levels)) {
    throw new Error("Invalid known-level response.");
  }

  const levels = new Map<number, KnownLevel>();
  for (const value of payload.levels) {
    if (
      !isRecord(value) ||
      !Number.isSafeInteger(value.level) ||
      Number(value.level) <= 0 ||
      typeof value.code !== "string" ||
      !value.code.startsWith("WS1:")
    ) {
      continue;
    }

    const level = Number(value.level);
    if (levels.has(level)) continue;

    const knownLevel: KnownLevel = { level, code: value.code };
    if (typeof value.updatedAt === "string") {
      knownLevel.updatedAt = value.updatedAt;
    }
    levels.set(level, knownLevel);
  }

  return [...levels.values()].sort((left, right) => left.level - right.level);
}

export function createKnownLevels(ctx: KnownLevelsContext) {
  const { el, importCode, showError, showSuccess } = ctx;
  const fetcher = ctx.fetcher ?? globalThis.fetch;
  let levels: KnownLevel[] = [];

  function setStatus(
    message: string,
    tone: "neutral" | "success" | "error" = "neutral",
  ): void {
    const status = el("knownLevelStatus");
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function renderOptions(): void {
    const select = el<HTMLSelectElement>("knownLevelSelect");
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = levels.length
      ? "Choose a level"
      : "No known levels";
    select.append(placeholder);

    for (const knownLevel of levels) {
      const option = document.createElement("option");
      option.value = String(knownLevel.level);
      option.textContent = `Level ${knownLevel.level}`;
      select.append(option);
    }

    select.disabled = levels.length === 0;
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = true;
  }

  async function loadKnownLevels(): Promise<void> {
    const select = el<HTMLSelectElement>("knownLevelSelect");
    select.disabled = true;
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = true;
    setStatus("Loading known levels...");

    try {
      const response = await fetcher("/api/levels", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Level request failed (${response.status}).`);
      }

      levels = parseKnownLevels(await response.json());
      renderOptions();
      setStatus(
        levels.length
          ? `${levels.length} known ${levels.length === 1 ? "level" : "levels"} available.`
          : "No solvable known levels are available yet.",
      );
    } catch {
      levels = [];
      renderOptions();
      setStatus(
        "Known levels are unavailable. Manual and saved-code imports still work.",
        "error",
      );
    }
  }

  function onKnownLevelChange(): void {
    const selectedLevel = Number.parseInt(
      el<HTMLSelectElement>("knownLevelSelect").value,
      10,
    );
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = !levels.some(
      (knownLevel) => knownLevel.level === selectedLevel,
    );
  }

  function importKnownLevel(): void {
    const selectedLevel = Number.parseInt(
      el<HTMLSelectElement>("knownLevelSelect").value,
      10,
    );
    const knownLevel = levels.find(
      (candidate) => candidate.level === selectedLevel,
    );
    if (!knownLevel) return;

    try {
      importCode(knownLevel.code);
      setStatus(
        `Level ${knownLevel.level} imported. Review it, then solve.`,
        "success",
      );
      showSuccess(`Level ${knownLevel.level} imported successfully.`);
    } catch {
      setStatus(`Level ${knownLevel.level} could not be imported.`, "error");
      showError(`Level ${knownLevel.level} contains an invalid puzzle code.`);
    }
  }

  return {
    importKnownLevel,
    loadKnownLevels,
    onKnownLevelChange,
  };
}
