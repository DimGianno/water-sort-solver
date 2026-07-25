import { CAP, COLOR_PALETTE, DEFAULT_COLORS } from "./constants.js";
import { createValidation } from "./validation.js";
import { createReplay } from "./replay.js";
import { createBuilder } from "./builder.js";
import { createImportExport } from "./io.js";
import { createSolver } from "./solver.js";

const el = (id) => document.getElementById(id);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const btn = el("themeBtn");
  if (!btn) return;

  const isDark = theme === "dark";
  btn.textContent = isDark ? "☀" : "◐";
  btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  btn.setAttribute("aria-label", btn.title);
}

function initTheme() {
  const btn = el("themeBtn");
  if (!btn) return;

  // 1) try saved theme
  const saved = localStorage.getItem("wss_theme");
  let theme = saved;

  // 2) otherwise follow system preference
  if (theme !== "dark" && theme !== "light") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }

  applyTheme(theme);

  // Toggle on click + persist
  btn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("wss_theme", next);
    applyTheme(next);
  });
}

const state = {
  bottleLayers: [],
  selectedLayer: null,
  openPopoverBottle: null,
  lastSolution: null,
  replayTimer: null,
  replayIndex: 0,
  fillMode: "layer",
  activeColor: null,
};

function showError(msg) {
  el("error").textContent = msg || "";
  el("success").textContent = "";
}

function showSuccess(msg) {
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
};

Object.assign(ctx, createValidation(ctx));
Object.assign(ctx, createReplay(ctx));
Object.assign(ctx, createBuilder(ctx));
Object.assign(ctx, createImportExport(ctx));
Object.assign(ctx, createSolver(ctx));

function resetAll() {
  el("numBottles").value = 11;
  el("showStates").checked = false;
  el("shortMoves").checked = true;
  el("modeSel").value = "fast";

  el("colorChecklist")
    .querySelectorAll('input[type="checkbox"]')
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
  el("output").textContent = "Your step-by-step solution will appear here.";
  el("solveBtn").disabled = true;
  el("fillToolbar").hidden = true;
  el("fillModeLayer").checked = true;

  ctx.hideIO();
  ctx.hideReplay();
  ctx.updateSelectAllVisibility();
  ctx.updateColorLimitUI();
}

initTheme();

ctx.buildChecklist();
ctx.updateSelectAllVisibility();

el("resetBtn").addEventListener("click", resetAll);

el("numBottles").addEventListener("change", () => {
  let v = parseInt(el("numBottles").value, 10);
  if (v > 14) v = 14;
  if (v < 4) v = 4;
  el("numBottles").value = v;

  const max = ctx.colorMaxAllowed();
  const checked = Array.from(el("colorChecklist").querySelectorAll('input[type="checkbox"]:checked'));
  if (checked.length > max) for (let k = max; k < checked.length; k++) checked[k].checked = false;

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

el("selectAllBtn").addEventListener("click", ctx.selectAllColors);
el("buildBtn").addEventListener("click", ctx.buildBottlesUI);


el("exportBtn").addEventListener("click", ctx.onExport);

el("solveBtn").addEventListener("click", ctx.solve);

el("prevStepBtn").addEventListener("click", ctx.stepPrev);
el("nextStepBtn").addEventListener("click", ctx.stepNext);
el("playBtn").addEventListener("click", ctx.playReplay);
el("pauseBtn").addEventListener("click", ctx.pauseReplay);
el("speedRange").addEventListener("input", ctx.onSpeedChange);
