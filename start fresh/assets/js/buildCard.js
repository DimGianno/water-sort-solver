// buildCard.js
// Step 3 module: renders bottles, lets user assign colors per layer using a popover palette,
// validates the build, supports Back/Next, and can restore a saved draft.

import { colorHex, colorName } from "./palette.js";

const CAP = 4;

export function initBuildCard(options = {}) {
  const { onBack, onNext } = options;

  const gridEl = document.getElementById("bottleGrid");
  const msgEl = document.getElementById("buildMsg");
  const backBtn = document.getElementById("buildBackBtn");
  const nextBtn = document.getElementById("buildNextBtn");
  const popover = document.getElementById("palettePopover");

  if (!gridEl || !msgEl || !backBtn || !nextBtn || !popover) {
    console.warn("BuildCard: missing HTML elements");
    return { configure: () => {} };
  }

  popover.addEventListener("click", (e) => e.stopPropagation()); // prevent clicks inside popover from closing it


  // Module state
  let bottleCount = 0;
  let helperCount = 2;
  let filledCount = 0;
  let allowedColors = [];
  let draft = []; // draft[bottleIndex][layerIndex] = colorId or ""

  let selectedCell = null; // { b, l, el }

  // ---------- Draft helpers ----------
  function createEmptyDraft(nBottles) {
    return Array.from({ length: nBottles }, () => Array(CAP).fill(""));
  }

  function cloneDraft(d) {
    return d.map(b => b.slice());
  }

  // ---------- Logic helpers ----------
  function splitIntoTwoRows(n) {
    const first = Math.ceil(n / 2);
    const second = n - first;
    return { first, second };
  }

  // ---------- Rendering ----------
  function render() {
    gridEl.innerHTML = "";

    const row1 = document.createElement("div");
    row1.className = "bottleRow";
    const row2 = document.createElement("div");
    row2.className = "bottleRow";

    gridEl.appendChild(row1);
    gridEl.appendChild(row2);

    const { first: row1Count } = splitIntoTwoRows(bottleCount);

    for (let b = 0; b < bottleCount; b++) {
      const bottle = document.createElement("div");
      bottle.className = "bottle" + (b >= filledCount ? " helper" : "");

      const layers = document.createElement("div");
      layers.className = "layers";

      for (let l = 0; l < CAP; l++) {
        const layer = document.createElement("div");
        layer.className = "layer";
        layer.dataset.b = String(b);
        layer.dataset.l = String(l);

        const value = draft[b][l];
        layer.style.background = value ? colorHex(value) : "transparent";

        // Only first (filledCount) bottles are editable
        const editable = b < filledCount;

        layer.addEventListener("click", (e) => {
            if (!editable) return;

            const alreadySelected =
                selectedCell && selectedCell.b === b && selectedCell.l === l;

            const hasColor = draft[b][l] !== "";

            // If you click again on the SAME selected layer and it has a color → clear it
            if (alreadySelected && hasColor) {
                draft[b][l] = "";
                render();

                requestAnimationFrame(() => selectCell(b, l));
                e.stopPropagation();
                return;
            }

            // Normal behavior: select this cell and open popover
            selectCell(b, l);
            e.stopPropagation();
        });


        layers.appendChild(layer);
      }

      const label = document.createElement("div");
      label.className = "bottleLabel";
      label.textContent = (b < filledCount) ? `Bottle ${b + 1}` : `Helper ${b - filledCount + 1}`;

      bottle.appendChild(layers);
      bottle.appendChild(label);

      const targetRow = (b < row1Count) ? row1 : row2;
        targetRow.appendChild(bottle);
    }

    updateValidationUI();
  }


  function clearSelectedHighlight() {
    const prev = gridEl.querySelector(".layer.isSelected");
    if (prev) prev.classList.remove("isSelected");
    selectedCell = null;
  }

  // --------------------------------- Popover -------------------------------
  function openPopoverNear(targetEl) {
    const r = targetEl.getBoundingClientRect();

    // Position popover under the clicked layer
    popover.style.left = `${r.left + window.scrollX}px`;
    popover.style.top = `${r.bottom + window.scrollY + 8}px`;
    popover.hidden = false;
  }

  function closePopover() {
    popover.hidden = true;
  }

  function renderPopoverButtons() {
    if (!selectedCell) return;
    const { remaining } = getCounts();


    popover.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "paletteGrid";

    // Color buttons (only show colors that still have remaining > 0)
    for (const id of allowedColors) {
        const left = remaining[id];

        // If a color has been used 4 times, it disappears from the palette
        if (left <= 0) continue;

        const wrap = document.createElement("div");
        wrap.className = "paletteBtnWrap";

        const btn = document.createElement("button");
        btn.className = "paletteBtn";
        btn.type = "button";
        btn.title = `${colorName(id)} (${left} left)`;
        btn.style.background = colorHex(id);

        // Remaining badge
        const badge = document.createElement("span");
        badge.className = "paletteBadge";
        badge.textContent = String(left);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            applyColorAndAdvance(id);
        });

        wrap.appendChild(btn);
        wrap.appendChild(badge);
        grid.appendChild(wrap);
    }

    popover.appendChild(grid);
  }

  // Close popover when clicking outside
  document.addEventListener("click", (e) => {
    if (popover.hidden) return;
    if (popover.contains(e.target)) return;
    closePopover();
    clearSelectedHighlight();
  });

  function getCounts() {
    // counts[colorId] = how many times it's used in the main bottles
    const counts = Object.fromEntries(allowedColors.map(id => [id, 0]));

    for (let b = 0; b < filledCount; b++) {
        for (let l = 0; l < CAP; l++) {
        const id = draft[b][l];
        if (id && counts.hasOwnProperty(id)) counts[id] += 1;
        }
    }

    // remaining = CAP - used
    const remaining = Object.fromEntries(
        allowedColors.map(id => [id, CAP - counts[id]])
    );

    return { counts, remaining };
  }

function findLayerEl(b, l) {
  return gridEl.querySelector(`.layer[data-b="${b}"][data-l="${l}"]`);
}

function selectCell(b, l) {
  clearSelectedHighlight();

  const el = findLayerEl(b, l);
  if (!el) return;

  el.classList.add("isSelected");
  selectedCell = { b, l, el };

  openPopoverNear(el);
  renderPopoverButtons();
}

function getNextCell(b, l) {
  // next layer down in the same bottle
  if (l < CAP - 1) return { b, l: l + 1 };

  // if bottle is done, jump to next bottle top layer
  if (b < filledCount - 1) return { b: b + 1, l: 0 };

  // no next cell
  return null;
}

function applyColorAndAdvance(colorId) {
  if (!selectedCell) return;

  const { b, l } = selectedCell;

  // set the chosen color
  draft[b][l] = colorId;

  // rerender so counts + button hiding update
  render();

  // move to next cell
  const next = getNextCell(b, l);

  // If there is a next cell, keep popover open and move it
  if (next) {
    requestAnimationFrame(() => selectCell(next.b, next.l));
  } else {
    closePopover();
    clearSelectedHighlight();
  }
}



  // ----------------------------- Validation -----------------------------------
  function validate() {
    // Rule 1: helper bottles must be empty
    for (let b = filledCount; b < bottleCount; b++) {
      for (let l = 0; l < CAP; l++) {
        if (draft[b][l] !== "") {
          return { ok: false, msg: "Helper bottles must stay empty." };
        }
      }
    }

    // Rule 2: first bottles should be fully filled (no empties)
    for (let b = 0; b < filledCount; b++) {
      for (let l = 0; l < CAP; l++) {
        if (draft[b][l] === "") {
          return { ok: false, msg: "Fill all layers in the main bottles." };
        }
      }
    }

    // Rule 3: each selected color must appear exactly 4 times
    const counts = Object.fromEntries(allowedColors.map(id => [id, 0]));

    for (let b = 0; b < filledCount; b++) {
      for (let l = 0; l < CAP; l++) {
        const id = draft[b][l];
        if (!counts.hasOwnProperty(id)) {
          return { ok: false, msg: `Invalid color used: ${id}` };
        }
        counts[id] += 1;
      }
    }

    const parts = [];
    for (const id of allowedColors) {
      parts.push(`${colorName(id)}: ${counts[id]}/${CAP}`);
      if (counts[id] !== CAP) {
        return { ok: false, msg: `Each selected color must appear exactly ${CAP} times. (${parts.join(" · ")})` };
      }
    }

    return { ok: true, msg: "Build looks valid ✅" };
  }

  function updateValidationUI() {
    const r = validate();
    msgEl.textContent = r.msg;
    nextBtn.disabled = !r.ok;
  }

  // ---------- Buttons ----------
  backBtn.addEventListener("click", () => {
    // Save current draft even if user didn’t press Continue
    if (typeof onBack === "function") onBack(cloneDraft(draft));
  });

  nextBtn.addEventListener("click", () => {
    const r = validate();
    if (!r.ok) return;

    if (typeof onNext === "function") onNext(cloneDraft(draft));
  });

  // ---------- Configure (called by app.js when entering step) ----------
  function configure({ bottleCount: n, selectedColors, draft: savedDraft }) {
    console.log("build.configure called", { n, selectedColors, savedDraft });

    bottleCount = n;
    allowedColors = Array.isArray(selectedColors) ? selectedColors : [];

    filledCount = bottleCount - helperCount;

    // Restore if draft exists, else create empty
    if (Array.isArray(savedDraft) && savedDraft.length === bottleCount) {
      draft = cloneDraft(savedDraft);
    } else {
      draft = createEmptyDraft(bottleCount);
    }

    closePopover();
    clearSelectedHighlight();
    render();
  }

  return { 
    configure,
    getDraft: () => cloneDraft(draft),
};
}
