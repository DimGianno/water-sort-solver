import {
  CAP,
  COLOR_PALETTE,
  DEFAULT_COLORS,
  SAMPLE_PUZZLE,
} from "./constants.ts";
import type { AppState, ElementLookup } from "./app-types.ts";
import { createValidation } from "./validation.ts";
import { createReplay } from "./replay.ts";
import { createBuilder } from "./builder.ts";
import { createImportExport } from "./io.ts";
import { createSolver } from "./solver.ts";
import { createOfflineSupport } from "./offline.ts";
import { createScreenshotImport } from "./screenshot.ts";

type Theme = "dark" | "light";

const EMPTY_OUTPUT_MESSAGE = "Your step-by-step solution will appear here.";

interface BaseContext {
  CAP: number;
  COLOR_PALETTE: Readonly<Record<string, string>>;
  DEFAULT_COLORS: readonly string[];
  state: AppState;
  el: ElementLookup;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

type AppContext = BaseContext &
  ReturnType<typeof createValidation> &
  ReturnType<typeof createReplay> &
  ReturnType<typeof createBuilder> &
  ReturnType<typeof createImportExport> &
  ReturnType<typeof createScreenshotImport> &
  ReturnType<typeof createSolver>;

const el: ElementLookup = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  const btn = el("themeBtn");
  if (!btn) return;

  const isDark = theme === "dark";
  btn.textContent = isDark ? "☀" : "◐";
  btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  btn.setAttribute("aria-label", btn.title);
}

function initTheme(): void {
  const btn = el("themeBtn");
  if (!btn) return;

  // 1) try saved theme
  const saved = localStorage.getItem("wss_theme");
  let theme: Theme;

  // 2) otherwise follow system preference
  if (saved !== "dark" && saved !== "light") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  } else theme = saved;

  applyTheme(theme);

  // Toggle on click + persist
  btn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("wss_theme", next);
    applyTheme(next);
  });
}

const state: AppState = {
  bottleLayers: [],
  selectedLayer: null,
  openPopoverBottle: null,
  lastSolution: null,
  replayTimer: null,
  replayIndex: 0,
  fillMode: "layer",
  activeColor: null,
  isSolving: false,
  revealReplayOnSolve: false,
};

function showError(msg: string): void {
  el("error").textContent = msg || "";
  el("success").textContent = "";
}

function showSuccess(msg: string): void {
  el("success").textContent = msg || "";
  el("error").textContent = "";
}

const ctx = {
  CAP,
  COLOR_PALETTE,
  DEFAULT_COLORS,
  state,
  el,
  showError,
  showSuccess,
} as unknown as AppContext;

Object.assign(ctx, createValidation(ctx));
Object.assign(ctx, createReplay(ctx));
Object.assign(ctx, createBuilder(ctx));
Object.assign(ctx, createImportExport(ctx));
Object.assign(ctx, createScreenshotImport(ctx));
Object.assign(ctx, createSolver(ctx));

function resetAll(): void {
  ctx.cancelSolve?.({ silent: true });
  el<HTMLInputElement>("numBottles").value = "11";
  el<HTMLInputElement>("showStates").checked = false;
  el<HTMLInputElement>("shortMoves").checked = false;
  el<HTMLSelectElement>("modeSel").value = "fast";

  el("colorChecklist")
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
      cb.disabled = false;
    });

  state.bottleLayers = [];
  state.selectedLayer = null;
  state.openPopoverBottle = null;
  state.lastSolution = null;
  state.fillMode = "layer";
  state.activeColor = null;
  state.revealReplayOnSolve = false;

  const bottleArea = el("bottleArea");
  bottleArea.className = "empty-stage";
  bottleArea.innerHTML = `
    <div class="empty-illustration" aria-hidden="true"><i></i><i></i><i></i></div>
    <strong>Your bottles will appear here</strong>
    <span>Select the bottle count and colors, then build the puzzle.</span>
  `;
  el("buildMsg").textContent = "";
  el("status").textContent = "Complete the puzzle above to unlock the solver.";
  el("validationMsg").textContent = "";
  el("error").textContent = "";
  el("success").textContent = "";
  el("output").textContent = EMPTY_OUTPUT_MESSAGE;
  el<HTMLButtonElement>("solveBtn").disabled = true;
  el("fillToolbar").hidden = true;
  el<HTMLInputElement>("fillModeLayer").checked = true;

  ctx.hideIO();
  ctx.closeScreenshotImport();
  ctx.hideReplay();
  ctx.updateSelectAllVisibility();
  ctx.updateColorLimitUI();
}

initTheme();
el("output").textContent = EMPTY_OUTPUT_MESSAGE;

void createOfflineSupport({
  statusElement: el("offlineStatus"),
  isProductionBuild: import.meta.env.PROD,
}).start();

ctx.buildChecklist();
ctx.updateSelectAllVisibility();

el("resetBtn").addEventListener("click", resetAll);

el("numBottles").addEventListener("change", () => {
  let v = parseInt(el<HTMLInputElement>("numBottles").value, 10);
  if (v > 14) v = 14;
  if (v < 4) v = 4;
  el<HTMLInputElement>("numBottles").value = String(v);

  const max = ctx.colorMaxAllowed();
  const checked = Array.from(
    el("colorChecklist").querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]:checked',
    ),
  );
  if (checked.length > max)
    for (let k = max; k < checked.length; k++) checked[k].checked = false;

  ctx.updateSelectAllVisibility();
  ctx.updateColorLimitUI();

  if (state.bottleLayers.length) {
    ctx.runContinuousValidation();
    ctx.updateSolveEnabled();
    ctx.renderPopover(state.openPopoverBottle);
  }
});
el("importBtn").addEventListener("click", ctx.onImport);
el("ioCloseBtn").addEventListener("click", ctx.hideIO);
el("ioApplyBtn").addEventListener("click", ctx.onIOApply);
el("screenshotBtn").addEventListener("click", ctx.chooseScreenshot);
el("screenshotInput").addEventListener("change", () => {
  void ctx.onScreenshotSelected();
});
el("screenshotApplyBtn").addEventListener("click", ctx.applyScreenshot);
el("screenshotCloseBtn").addEventListener("click", ctx.closeScreenshotImport);

el("selectAllBtn").addEventListener("click", ctx.selectAllColors);
el("buildBtn").addEventListener("click", ctx.buildBottlesUI);
el("sampleBtn").addEventListener("click", () => {
  ctx.hideIO();
  ctx.applyImport(SAMPLE_PUZZLE);
  state.revealReplayOnSolve = true;
  ctx.solve();
});

el("exportBtn").addEventListener("click", ctx.onExport);

el("solveBtn").addEventListener("click", ctx.solve);

el("prevStepBtn").addEventListener("click", ctx.stepPrev);
el("nextStepBtn").addEventListener("click", ctx.stepNext);
el("playBtn").addEventListener("click", ctx.playReplay);
el("pauseBtn").addEventListener("click", ctx.pauseReplay);
el("speedRange").addEventListener("input", ctx.onSpeedChange);
