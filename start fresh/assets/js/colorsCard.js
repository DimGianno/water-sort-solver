import { PALETTE } from "./palette.js";
// colorsCard.js
// Step 2 module: renders selectable colors, enforces "select exactly N", supports Back/Next,
// and can preload previous selections.

const ALL_IDS = PALETTE.map(c => c.id);

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}


export function initColorsCard(options = {}) {
  const { onBack, onNext } = options;

  const checklistEl = document.getElementById("colorChecklist");
  const hintEl = document.getElementById("colorsHint");
  const selectAllBtn = document.getElementById("colorsSelectAllBtn");
  const msgEl = document.getElementById("colorsMsg");
  const backBtn = document.getElementById("colorsBackBtn");
  const nextBtn = document.getElementById("colorsNextBtn");

  if (!checklistEl || !hintEl || !msgEl || !backBtn || !nextBtn) {
    console.warn("ColorsCard: missing HTML elements");
    return { configure: () => {} };
  }

  // Internal state for this module
  let requiredCount = 0;
  let selected = new Set();

  function render() {
    checklistEl.innerHTML = "";

    for (const c of PALETTE) {
      const item = document.createElement("label");
      item.className = "colorItem";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = c.id;
      cb.checked = selected.has(c.id);

      const dot = document.createElement("span");
      dot.className = "colorDot";
      dot.style.background = c.hex;

      const name = document.createElement("span");
      name.textContent = c.name;

      // When user clicks checkbox
      cb.addEventListener("change", () => {
        if (cb.checked) {
          // Prevent selecting more than requiredCount
          if (selected.size >= requiredCount) {
            cb.checked = false;
            msgEl.textContent = `You can only select ${requiredCount} colors.`;
            return;
          }
          selected.add(c.id);
        } else {
          selected.delete(c.id);
        }

        updateUI();
      });

      item.appendChild(cb);
      item.appendChild(dot);
      item.appendChild(name);

      checklistEl.appendChild(item);
    }
  }

  function updateUI() {
    hintEl.textContent = `Select exactly ${requiredCount} colors. Selected: ${selected.size}/${requiredCount}.`;

    const ok = selected.size === requiredCount;
    nextBtn.disabled = !ok;

    // Clear message when state becomes valid
    if (ok) msgEl.textContent = "";
  }

  backBtn.addEventListener("click", () => {
    if (typeof onBack === "function") onBack(Array.from(selected));
  });

  nextBtn.addEventListener("click", () => {
    const arr = Array.from(selected);

    if (arr.length !== requiredCount) return;

    if (typeof onNext === "function") onNext(arr);
  });

  // This is how app.js configures this step when entering it.
  function configure({ required, preselected }) {
    requiredCount = required;

    const pre = Array.isArray(preselected) ? preselected : [];
    selected = new Set(pre);

    // If preselected has too many (e.g., bottle count changed smaller),
    // trim it to requiredCount in a simple way.
    if (selected.size > requiredCount) {
      selected = new Set(Array.from(selected).slice(0, requiredCount));
    }

    selectAllBtn.hidden = (required !== ALL_IDS.length);  // only show when 12 needed

    render();
    updateUI();
  }

  selectAllBtn.addEventListener("click", () => {
    selected = new Set(ALL_IDS);   
    render();           
    updateUI();                    
  });


  return {
    configure,

    // Optional helper to detect changes externally if we want it:
    sameSet,
    getSelected: () => Array.from(selected),
  };
}








