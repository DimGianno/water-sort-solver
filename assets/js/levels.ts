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

const BROWSE_PAGE_SIZE = 50;
type CatalogState = "loading" | "ready" | "empty" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLevelQuery(query: string): string {
  return query
    .trim()
    .replace(/^level\s*/i, "")
    .replaceAll(",", "")
    .replaceAll(" ", "");
}

export function filterKnownLevels(
  levels: readonly KnownLevel[],
  query: string,
): KnownLevel[] {
  const normalizedQuery = normalizeLevelQuery(query);
  if (!normalizedQuery) return [...levels];
  if (!/^\d+$/.test(normalizedQuery)) return [];

  return levels.filter((knownLevel) =>
    String(knownLevel.level).startsWith(normalizedQuery),
  );
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
  let levelsByNumber = new Map<number, KnownLevel>();
  let selectedLevel: KnownLevel | null = null;
  let browsePage = 1;
  let catalogState: CatalogState = "loading";

  function setStatus(
    message: string,
    tone: "neutral" | "success" | "error" = "neutral",
  ): void {
    const status = el("knownLevelStatus");
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function catalogStatusMessage(): string {
    if (catalogState === "loading") return "Loading known levels...";
    if (catalogState === "error") {
      return "Known levels are unavailable. Manual and saved-code imports still work.";
    }
    if (catalogState === "empty") {
      return "No solvable known levels are available yet.";
    }

    return `${levels.length.toLocaleString()} known ${levels.length === 1 ? "level" : "levels"} available.`;
  }

  function resetKnownLevelSelection(): void {
    selectedLevel = null;
    el<HTMLInputElement>("knownLevelSearch").value = "";
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = true;
    setStatus(
      catalogStatusMessage(),
      catalogState === "error" ? "error" : "neutral",
    );
  }

  function setCatalogEnabled(enabled: boolean): void {
    el<HTMLInputElement>("knownLevelSearch").disabled = !enabled;
    el<HTMLButtonElement>("knownLevelBrowseBtn").disabled = !enabled;
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = true;
  }

  function selectKnownLevel(knownLevel: KnownLevel): void {
    selectedLevel = knownLevel;
    el<HTMLInputElement>("knownLevelSearch").value = String(knownLevel.level);
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = false;
    setStatus(`Level ${knownLevel.level.toLocaleString()} is ready to import.`);
  }

  function renderKnownLevelBrowser(): void {
    const query = el<HTMLInputElement>("knownLevelDialogSearch").value;
    const matches = filterKnownLevels(levels, query);
    const pageCount = Math.ceil(matches.length / BROWSE_PAGE_SIZE);
    browsePage = pageCount ? Math.min(Math.max(browsePage, 1), pageCount) : 1;

    const start = (browsePage - 1) * BROWSE_PAGE_SIZE;
    const visibleLevels = matches.slice(start, start + BROWSE_PAGE_SIZE);
    const results = el<HTMLUListElement>("knownLevelResults");
    results.replaceChildren();

    for (const knownLevel of visibleLevels) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "known-level-result";
      button.dataset.level = String(knownLevel.level);
      button.textContent = `Level ${knownLevel.level.toLocaleString()}`;
      item.append(button);
      results.append(item);
    }

    el("knownLevelResultCount").textContent = matches.length
      ? `Showing ${start + 1}-${start + visibleLevels.length} of ${matches.length.toLocaleString()} ${matches.length === 1 ? "level" : "levels"}.`
      : "No levels match that number.";
    el("knownLevelPage").textContent = pageCount
      ? `Page ${browsePage} of ${pageCount}`
      : "Page 0 of 0";
    el<HTMLButtonElement>("knownLevelPrevBtn").disabled = browsePage <= 1;
    el<HTMLButtonElement>("knownLevelNextBtn").disabled =
      !pageCount || browsePage >= pageCount;
  }

  async function loadKnownLevels(): Promise<void> {
    catalogState = "loading";
    setCatalogEnabled(false);
    setStatus(catalogStatusMessage());

    try {
      const response = await fetcher("/api/levels", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Level request failed (${response.status}).`);
      }

      levels = parseKnownLevels(await response.json());
      levelsByNumber = new Map(
        levels.map((knownLevel) => [knownLevel.level, knownLevel]),
      );
      catalogState = levels.length ? "ready" : "empty";
      setCatalogEnabled(levels.length > 0);
      resetKnownLevelSelection();
    } catch {
      levels = [];
      levelsByNumber = new Map();
      selectedLevel = null;
      catalogState = "error";
      el<HTMLInputElement>("knownLevelSearch").value = "";
      setCatalogEnabled(false);
      setStatus(catalogStatusMessage(), "error");
    }
  }

  function onKnownLevelInput(): void {
    const query = el<HTMLInputElement>("knownLevelSearch").value;
    const normalizedQuery = normalizeLevelQuery(query);
    const levelNumber = /^\d+$/.test(normalizedQuery)
      ? Number(normalizedQuery)
      : Number.NaN;
    const match = levelsByNumber.get(levelNumber);

    if (match) {
      selectKnownLevel(match);
      return;
    }

    selectedLevel = null;
    el<HTMLButtonElement>("knownLevelImportBtn").disabled = true;
    setStatus(
      normalizedQuery
        ? "No exact known level matches that number."
        : catalogStatusMessage(),
    );
  }

  function openKnownLevelBrowser(): void {
    if (!levels.length) return;

    const dialog = el<HTMLDialogElement>("knownLevelDialog");
    const dialogSearch = el<HTMLInputElement>("knownLevelDialogSearch");
    dialogSearch.value = el<HTMLInputElement>("knownLevelSearch").value;
    browsePage = 1;
    renderKnownLevelBrowser();
    if (!dialog.open) dialog.showModal();
    dialogSearch.focus();
  }

  function closeKnownLevelBrowser(): void {
    const dialog = el<HTMLDialogElement>("knownLevelDialog");
    if (dialog.open) dialog.close();
  }

  function onKnownLevelBrowserInput(): void {
    browsePage = 1;
    renderKnownLevelBrowser();
  }

  function showPreviousKnownLevels(): void {
    browsePage -= 1;
    renderKnownLevelBrowser();
  }

  function showNextKnownLevels(): void {
    browsePage += 1;
    renderKnownLevelBrowser();
  }

  function onKnownLevelBrowserClick(event: Event): void {
    if (!(event.target instanceof Element)) return;

    const button =
      event.target.closest<HTMLButtonElement>("button[data-level]");
    if (!button) return;

    const knownLevel = levelsByNumber.get(Number(button.dataset.level));
    if (!knownLevel) return;

    selectKnownLevel(knownLevel);
    closeKnownLevelBrowser();
  }

  function importKnownLevel(): void {
    if (!selectedLevel) return;

    try {
      importCode(selectedLevel.code);
      setStatus(
        `Level ${selectedLevel.level.toLocaleString()} imported. Review it, then solve.`,
        "success",
      );
      showSuccess(
        `Level ${selectedLevel.level.toLocaleString()} imported successfully.`,
      );
    } catch {
      setStatus(
        `Level ${selectedLevel.level.toLocaleString()} could not be imported.`,
        "error",
      );
      showError(
        `Level ${selectedLevel.level.toLocaleString()} contains an invalid puzzle code.`,
      );
    }
  }

  return {
    closeKnownLevelBrowser,
    importKnownLevel,
    loadKnownLevels,
    onKnownLevelBrowserClick,
    onKnownLevelBrowserInput,
    onKnownLevelInput,
    openKnownLevelBrowser,
    resetKnownLevelSelection,
    showNextKnownLevels,
    showPreviousKnownLevels,
  };
}
