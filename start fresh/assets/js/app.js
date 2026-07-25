import { initTheme } from "./theme.js"; 
import { initSetupCard } from "./setupCard.js"; 
import { initColorsCard } from "./colorsCard.js";
import { initBuildCard } from "./buildCard.js";
import { initIOPanel } from "./ioPanel.js";
import { COLOR_BY_ID } from "./palette.js";
import { initSolveCard } from "./solveCard.js";
import { initScreenshotImport } from "./screenshotImport.js";


// 1) Initialize theme feature
initTheme();




// --- 2) Grab the step sections ---
const setupCard = document.getElementById("setupCard");
const colorsCard = document.getElementById("colorsCard");
const buildCard = document.getElementById("buildCard");
const solveCard = document.getElementById("solveCard");

let currentStep = "setup"; // for debugging
// A helper that shows ONLY one card at a time
function showOnly(which) {
  currentStep = which; // for debugging
  setupCard.hidden = which !== "setup";
  colorsCard.hidden = which !== "colors";
  buildCard.hidden = which !== "build";
  solveCard.hidden = which !== "solve";
}





// --- 3) App state (single source of truth) ---
const state = {
  bottleCount: null,
  selectedColors: [],
  buildDraft: null,
  // later:
  // replay: null,
};

// Compare arrays as sets (order doesn't matter)
function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}

// If colors change, downstream work becomes invalid
function invalidateAfterColorsChange() {
  state.buildDraft = null;
  // Later we will do:
  // state.solution = null;
  // state.replay = null;
}

// --- 4) Initialize solve step ---
const solveStep = initSolveCard({
  onBack: () => {
    buildStep.configure({
      bottleCount: state.bottleCount,
      selectedColors: state.selectedColors,
      draft: state.buildDraft,
    });
    showOnly("build");
  },
});


// --- 4.1) Initialize step 3 (build) ---
const buildStep = initBuildCard({
  onBack: (draft) => {
    // Save draft even when going back
    state.buildDraft = draft;

    // Return to colors (restore selections from state)
    colorsStep.configure({
      required: state.bottleCount - 2,
      preselected: state.selectedColors,
    });

    showOnly("colors");
  },
  onNext: (draft) => {
    state.buildDraft = draft;

    solveStep.configure({
      bottleCount: state.bottleCount,
      selectedColors: state.selectedColors,
      draft: state.buildDraft,
    });
    showOnly("solve");
  },
});

// --- 4.2) Initialize Step 2  ---
const colorsStep = initColorsCard({
  onBack: (currentSelected) => {
    // Going back should keep selections (they remain in state)
    state.selectedColors = currentSelected;
    showOnly("setup");
  },
  onNext: (newSelectedColors) => {
    const changed = !sameSet(state.selectedColors, newSelectedColors);

    state.selectedColors = newSelectedColors;

    if (changed) invalidateAfterColorsChange();

    // Enter build step (restore draft if exists)
    buildStep.configure({
      bottleCount: state.bottleCount,
      selectedColors: state.selectedColors,
      draft: state.buildDraft,
    });
    showOnly("build");
  },
});




// --- 5) Initialize Step 1 module ---
const setupStep = initSetupCard({
    onNext: (bottleCount) => {
      state.bottleCount = bottleCount;

      // Rule: last 2 bottles are empty helpers,
      // so number of colors needed = bottleCount - 2
      const requiredColors = bottleCount - 2;

      // Configure colors step (and preload previous selections)
      colorsStep.configure({
        required: requiredColors,
        preselected: state.selectedColors,
      });

      showOnly("colors");
    }
});


// --- 7) Start at step 1 ---
showOnly("setup");

// --- 8) Export data ---
function getExportData() {
  const bottleCount = state.bottleCount;

  // If nothing meaningful exists yet, return null.
  if (!Number.isInteger(bottleCount)) return null;

  const selectedColors =
    (currentStep === "colors") ? colorsStep.getSelected() : state.selectedColors;

  const draft =
    (currentStep === "build") ? buildStep.getDraft() : state.buildDraft;

  // If draft isn't available yet, still export partial state.
  return {
    version: 1,
    bottleCount,
    selectedColors,
    draft: draft || null,
  };
}

// --- 9) Import data ---
function importData(obj) {
  // Basic shape
  const bottleCount = obj?.bottleCount;
  const selectedColors = obj?.selectedColors;
  const draft = obj?.draft;

  if (!Number.isInteger(bottleCount) || bottleCount < 4 || bottleCount > 14) {
    return { ok: false, msg: "Import error: bottleCount must be an integer from 4 to 14." };
  }

  if (!Array.isArray(selectedColors) || selectedColors.length !== bottleCount - 2) {
    return { ok: false, msg: `Import error: selectedColors must have exactly ${bottleCount - 2} items.` };
  }

  // Validate color ids exist
  const unknown = selectedColors.filter(id => !COLOR_BY_ID[id]);
  if (unknown.length) {
    return { ok: false, msg: `Import error: unknown color ids: ${unknown.join(", ")}` };
  }

  // Draft can be null (partial import) — but if provided, validate it
  let cleanDraft = null;

  if (draft !== null) {
    if (!Array.isArray(draft) || draft.length !== bottleCount) {
      return { ok: false, msg: "Import error: draft must be an array with length = bottleCount." };
    }

    for (let b = 0; b < bottleCount; b++) {
      if (!Array.isArray(draft[b]) || draft[b].length !== 4) {
        return { ok: false, msg: `Import error: bottle ${b + 1} must have exactly 4 layers.` };
      }
      for (let l = 0; l < 4; l++) {
        const v = draft[b][l];
        if (typeof v !== "string") {
          return { ok: false, msg: `Import error: bottle ${b + 1}, layer ${l + 1} must be a string.` };
        }
        if (v !== "" && !COLOR_BY_ID[v]) {
          return { ok: false, msg: `Import error: unknown color id in draft: "${v}".` };
        }
      }
    }

    cleanDraft = draft;
  }

  // Apply to global state
  state.bottleCount = bottleCount;
  state.selectedColors = selectedColors;
  state.buildDraft = cleanDraft;

  // Update step 1 input so Back shows correct number
  setupStep.setBottleCount(bottleCount);

  // Configure step 2 so Back shows correct colors
  colorsStep.configure({
    required: bottleCount - 2,
    preselected: selectedColors,
  });

  // Configure step 3 with the imported draft (or empty)
  buildStep.configure({
    bottleCount,
    selectedColors,
    draft: cleanDraft,
  });

  // Jump user to Build step to review/edit
  showOnly("build");

  return { ok: true, msg: "Imported. Jumped to Step 3 (Build)." };
}


// --- 10) Initialize IO panel with export and import handlers ---
const ioPanel = initIOPanel({ 
  getExportData, 
  onImport: importData, 
});

// --- 11) reset button ---
const resetBtn = document.getElementById("resetBtn");
function resetApp() {
  // close IO modal if open
  ioPanel?.close?.();

  // reset global state
  state.bottleCount = null;
  state.selectedColors = [];
  state.buildDraft = null;

  // close build popover just in case
  const pop = document.getElementById("palettePopover");
  if (pop) pop.hidden = true;

  // reset step 1 UI to initial
  setupStep.reset?.();

  // go back to step 1
  showOnly("setup");
}
resetBtn?.addEventListener("click", resetApp);


// --- 12) Initialize screenshot import ---
initScreenshotImport({
  onImportPuzzle: ({ bottleCount, selectedColors, draft }) => {
    // apply to state
    state.bottleCount = bottleCount;
    state.selectedColors = selectedColors;
    state.buildDraft = draft;

    // sync UI modules
    setupStep.setBottleCount(bottleCount);

    colorsStep.configure({
      required: bottleCount - 2,
      preselected: selectedColors,
    });

    buildStep.configure({
      bottleCount,
      selectedColors,
      draft,
    });

    showOnly("build");
    return { ok: true };
  },
});










