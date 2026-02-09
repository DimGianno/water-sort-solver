import { CAP, COLOR_PALETTE, DEFAULT_COLORS } from "./constants.js";
import { createValidation } from "./validation.js";
import { createReplay } from "./replay.js";
import { createBuilder } from "./builder.js";
import { createImportExport } from "./io.js";
import { createSolver } from "./solver.js";

const el = (id) => document.getElementById(id);

const state = {
  bottleLayers: [],
  selectedLayer: null,
  inputHistory: [],
  openPopoverBottle: null,
  lastSolution: null,
  replayTimer: null,
  replayIndex: 0,
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
  state.inputHistory = [];
  state.openPopoverBottle = null;
  state.lastSolution = null;

  el("bottleArea").innerHTML = "";
  el("buildMsg").textContent = "";
  el("status").textContent = "";
  el("validationMsg").textContent = "";
  el("error").textContent = "";
  el("success").textContent = "";
  el("output").textContent = "Build bottles UI, enter colors, then press Solve.";
  el("solveBtn").disabled = true;
  el("undoBtn").disabled = true;

  ctx.hideIO();
  ctx.hideReplay();
  ctx.updateSelectAllVisibility();
  ctx.updateColorLimitUI();
}

ctx.buildChecklist();
ctx.updateSelectAllVisibility();

el("resetBtn").addEventListener("click", resetAll);
el("undoBtn").addEventListener("click", ctx.undoLastInput);
el("buildBtn").addEventListener("click", ctx.buildBottlesUI);

el("selectAllBtn").addEventListener("click", ctx.selectAllColors);

el("exportBtn").addEventListener("click", ctx.onExport);
el("importBtn").addEventListener("click", ctx.onImport);
el("ioApplyBtn").addEventListener("click", ctx.onIOApply);
el("ioCloseBtn").addEventListener("click", ctx.hideIO);

el("solveBtn").addEventListener("click", ctx.solve);

el("prevStepBtn").addEventListener("click", ctx.stepPrev);
el("nextStepBtn").addEventListener("click", ctx.stepNext);
el("playBtn").addEventListener("click", ctx.playReplay);
el("pauseBtn").addEventListener("click", ctx.pauseReplay);
el("speedRange").addEventListener("input", ctx.onSpeedChange);

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
