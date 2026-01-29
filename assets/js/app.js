const CAP = 4;

const COLOR_PALETTE = {
  "Red": "#e53935",
  "Pink": "#ec407a",
  "Orange": "#fb8c00",
  "Yellow": "#fdd835",
  "Green": "#43a047",
  "Dark Green": "#1b5e20",
  "Light Green": "#9ccc65",
  "Blue": "#1e88e5",
  "Light Blue": "#81d4fa",
  "Purple": "#8e24aa",
  "Gray": "#9e9e9e",
  "Brown": "#6d4c41",
};
const DEFAULT_COLORS = Object.keys(COLOR_PALETTE);

const el = (id) => document.getElementById(id);

function selectedColors() {
  return Array.from(el("colorChecklist").querySelectorAll("input[type=checkbox]:checked"))
    .map(x => x.value);
}

function showError(msg) {
  el("error").textContent = msg;
  el("success").textContent = "";
  el("status").textContent = "";
}

function showSuccess(msg) {
  el("success").textContent = msg;
  el("error").textContent = "";
}

// ---------- Improvement #1: checkbox max = bottles-2 ----------
function colorMaxAllowed() {
  const n = parseInt(el("numBottles").value, 10);
  return Math.max(1, Math.min(12, n - 2)); // max bottles=14 => max colors=12
}

function updateColorLimitUI() {
  const max = colorMaxAllowed();
  const chosen = selectedColors().length;
  el("colorLimitHint").textContent = `Selected ${chosen}/${max} colors.`;

  const checkboxes = Array.from(el("colorChecklist").querySelectorAll("input[type=checkbox]"));
  const lock = chosen >= max;
  for (const cb of checkboxes) {
    if (!cb.checked) cb.disabled = lock;
    else cb.disabled = false;
  }
}

function buildChecklist() {
  const box = el("colorChecklist");
  box.innerHTML = "";

  DEFAULT_COLORS.forEach((c) => {
    const lab = document.createElement("label");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c;
    cb.addEventListener("change", () => {
      // enforce max selection
      const max = colorMaxAllowed();
      const chosen = selectedColors().length;
      if (chosen > max) cb.checked = false;

      updateColorLimitUI();
      updateAllDropdownOptions();
      updateSolveEnabled();
    });

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = COLOR_PALETTE[c] || "#ccc";

    const name = document.createElement("span");
    name.textContent = c;

    lab.appendChild(cb);
    lab.appendChild(sw);
    lab.appendChild(name);
    box.appendChild(lab);
  });

  updateColorLimitUI();
}

// ---------- Reset ----------
function resetAll() {
  el("numBottles").value = 11;
  el("showStates").checked = true;
  el("shortMoves").checked = false;

  el("colorChecklist").querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = false;
    cb.disabled = false;
  });

  el("bottleArea").innerHTML = "";
  el("buildMsg").textContent = "";
  el("status").textContent = "";
  el("error").textContent = "";
  el("success").textContent = "";
  el("output").textContent = "Build bottles UI, enter colors, then press Solve.";
  el("solveBtn").disabled = true;

  updateColorLimitUI();
}

// ---------- Build bottles ----------
function buildBottlesUI() {
  const n = parseInt(el("numBottles").value, 10);
  const colors = selectedColors();

  el("error").textContent = "";
  el("success").textContent = "";

  if (!Number.isFinite(n) || n < 3) return showError("Number of bottles must be >= 3.");
  if (n > 14) return showError("Max bottles is 14.");

  const maxColors = n - 2;
  if (colors.length === 0) return showError("Select at least 1 color.");
  if (colors.length > maxColors) return showError(`Too many colors selected. Max is ${maxColors}.`);

  const area = el("bottleArea");
  area.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const isHelperEmpty = (i >= n - 2);

    const b = document.createElement("div");
    b.className = "bottle";
    b.dataset.index = String(i);

    const title = document.createElement("h3");
    title.innerHTML = `<span>Bottle ${i+1}</span><span class="small">${isHelperEmpty ? "EMPTY" : ""}</span>`;
    b.appendChild(title);

    const layers = document.createElement("div");
    layers.className = "layers";

    for (let row = 0; row < CAP; row++) {
      const sel = document.createElement("select");
      sel.dataset.layer = String(row);

      if (isHelperEmpty) {
        sel.disabled = true;
        sel.innerHTML = `<option value="" hidden></option>`;
      } else {
        // Improvement #4: hidden empty option (no visible "(choose color)")
        sel.innerHTML = `<option value="" hidden></option>`;
        sel.addEventListener("change", () => {
          setSelectBackground(sel);
          updateAllDropdownOptions();
          updateSolveEnabled();
        });
      }

      layers.appendChild(sel);
    }

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = isHelperEmpty
      ? "Helper bottle (forced empty)"
      : "Set colors TOP → BOTTOM (must fill all 4 layers). Dropdown shows remaining layers per color.";
    b.appendChild(layers);
    b.appendChild(hint);

    area.appendChild(b);
  }

  el("buildMsg").textContent = `Built ${n} bottles (capacity fixed to 4).`;
  el("status").textContent = "Fill the bottles; remaining counts update automatically.";
  el("output").textContent = "Ready.";

  updateAllDropdownOptions(true);
  updateSolveEnabled();
}

function getAllUserSelects() {
  return Array.from(el("bottleArea").querySelectorAll(".bottle select"))
    .filter(sel => !sel.disabled);
}

function computeUsedCounts() {
  const counts = new Map();
  DEFAULT_COLORS.forEach(c => counts.set(c, 0));
  for (const sel of getAllUserSelects()) {
    const v = sel.value;
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

function setSelectBackground(sel) {
  const v = sel.value;
  if (!v) {
    sel.style.backgroundColor = "";
    sel.style.color = "";
    return;
  }
  const bg = COLOR_PALETTE[v] || "";
  sel.style.backgroundColor = bg;
  sel.style.color = (v === "Yellow" || v === "Light Blue" || v === "Light Green") ? "#111" : "#fff";
}

function updateAllDropdownOptions(initialPopulate = false) {
  const area = el("bottleArea");
  if (!area || area.children.length === 0) return;

  const colors = selectedColors();
  if (colors.length === 0) return;

  const used = computeUsedCounts();
  const selects = getAllUserSelects();

  for (const sel of selects) {
    const current = sel.value || "";

    const opts = [];
    // hidden empty option (no visible label)
    opts.push({ value: "", label: "", hidden: true });

    for (const c of colors) {
      const usedTotal = used.get(c) || 0;
      const effectiveUsed = usedTotal - (current === c ? 1 : 0);
      const remainingNow = CAP - effectiveUsed;

      if (remainingNow <= 0 && current !== c) continue;

      const label = (current === c) ? `${c}` : `${c} (${Math.max(0, remainingNow)} left)`;
      opts.push({ value: c, label, hidden: false });
    }

    sel.innerHTML = "";
    for (const o of opts) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.hidden) opt.hidden = true;

      if (o.value && COLOR_PALETTE[o.value]) {
        opt.style.backgroundColor = COLOR_PALETTE[o.value];
        opt.style.color = (o.value === "Yellow" || o.value === "Light Blue" || o.value === "Light Green") ? "#111" : "#fff";
      }
      sel.appendChild(opt);
    }

    if (current) {
      const found = Array.from(sel.options).some(o => o.value === current);
      sel.value = found ? current : "";
    } else if (initialPopulate) {
      sel.value = "";
    }

    setSelectBackground(sel);
  }

  const n = parseInt(el("numBottles").value, 10);
  const totalSlots = (n - 2) * CAP;
  const filled = selects.filter(s => s.value).length;
  el("status").textContent = `Filled ${filled}/${totalSlots} layers.`;
}

// ---------- Solve enabled only when ready (Improvement #3) ----------
function allPlacedAndValid() {
  const area = el("bottleArea");
  if (!area || area.children.length === 0) return { ok:false, reason:"Build bottles UI first." };

  const n = parseInt(el("numBottles").value, 10);
  const colors = selectedColors();
  if (colors.length === 0) return { ok:false, reason:"Select colors first." };

  const max = n - 2;
  if (colors.length > max) return { ok:false, reason:`Too many colors selected.` };

  const selects = getAllUserSelects();
  const totalSlots = (n - 2) * CAP;

  const filled = selects.filter(s => s.value).length;
  if (filled !== totalSlots) return { ok:false, reason:"Fill all layers first." };

  const used = computeUsedCounts();
  for (const c of colors) {
    if ((used.get(c) || 0) !== CAP) return { ok:false, reason:`"${c}" is not exactly 4.` };
  }
  return { ok:true, reason:"Ready." };
}

function updateSolveEnabled() {
  const verdict = allPlacedAndValid();
  el("solveBtn").disabled = !verdict.ok;
}

// ---------- Solver (BFS) ----------
function isSolved(state) {
  for (const b of state) {
    if (b.length === 0) continue;
    if (b.length !== CAP) return false;
    const c0 = b[0];
    for (let i = 1; i < b.length; i++) if (b[i] !== c0) return false;
  }
  return true;
}

function topRun(b) {
  if (b.length === 0) return null;
  const tc = b[b.length - 1];
  let run = 1;
  for (let i = b.length - 2; i >= 0; i--) {
    if (b[i] === tc) run++;
    else break;
  }
  return { color: tc, run };
}

function canPour(src, dst) {
  if (src.length === 0) return false;
  if (dst.length >= CAP) return false;
  if (dst.length === 0) return true;
  return dst[dst.length - 1] === src[src.length - 1];
}

function doPour(src, dst) {
  const tr = topRun(src);
  const space = CAP - dst.length;
  const amt = Math.min(tr.run, space);
  const newSrc = src.slice(0, src.length - amt);
  const newDst = dst.concat(Array(amt).fill(tr.color));
  return { newSrc, newDst, amt, color: tr.color };
}

function encodeState(state) {
  return state.map(b => b.join(",")).join("|");
}

function cloneState(state) {
  return state.map(b => b.slice());
}

function usefulMovePrune(src, dst) {
  if (dst.length === 0 && src.length === CAP) {
    const c0 = src[0];
    let allSame = true;
    for (let i = 1; i < src.length; i++) if (src[i] !== c0) { allSame = false; break; }
    if (allSame) return false;
  }
  return true;
}

function bfsSolve(startState, maxStates = 400000) {
  const startKey = encodeState(startState);
  const q = [startState];
  let qHead = 0;

  const parent = new Map();
  parent.set(startKey, null);

  let explored = 0;

  while (qHead < q.length) {
    const state = q[qHead++];
    explored++;

    if (explored % 5000 === 0) {
      el("status").textContent = `Searching... explored ${explored.toLocaleString()} states`;
    }
    if (explored > maxStates) {
      return { ok:false, reason:`State limit reached (${maxStates.toLocaleString()}).`, explored };
    }

    if (isSolved(state)) {
      const solMoves = [];
      let key = encodeState(state);
      while (parent.get(key) !== null) {
        const rec = parent.get(key);
        solMoves.push(rec.move);
        key = rec.prevKey;
      }
      solMoves.reverse();
      return { ok:true, moves: solMoves, explored };
    }

    const n = state.length;
    const curKey = encodeState(state);
    const curRec = parent.get(curKey);
    const lastMove = curRec ? curRec.move : null;

    for (let i = 0; i < n; i++) {
      const src = state[i];
      if (src.length === 0) continue;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (lastMove && lastMove.from === j && lastMove.to === i) continue;

        const dst = state[j];
        if (!canPour(src, dst)) continue;
        if (!usefulMovePrune(src, dst)) continue;

        const next = cloneState(state);
        const res = doPour(next[i], next[j]);
        next[i] = res.newSrc;
        next[j] = res.newDst;

        const key = encodeState(next);
        if (!parent.has(key)) {
          parent.set(key, { prevKey: curKey, move: { from:i, to:j, amt:res.amt, color:res.color } });
          q.push(next);
        }
      }
    }
  }

  return { ok:false, reason:"No solution found (input may be invalid).", explored };
}

// ---------- Read & Validate ----------
function readStateFromUI() {
  const n = parseInt(el("numBottles").value, 10);

  const bottles = [];
  for (let i = 0; i < n; i++) {
    const b = el("bottleArea").querySelector(`.bottle[data-index="${i}"]`);
    const selects = Array.from(b.querySelectorAll("select"));
    const topToBottom = selects.map(s => s.value).filter(v => v !== "");
    const bottomToTop = topToBottom.slice().reverse();
    bottles.push(bottomToTop);
  }
  return bottles;
}

function validateInput(bottles) {
  const n = bottles.length;
  const colors = selectedColors();
  if (colors.length === 0) return "Select colors first.";

  if (bottles[n-1].length !== 0 || bottles[n-2].length !== 0) {
    return "Last 2 bottles must be empty (helpers).";
  }

  for (let i = 0; i < n - 2; i++) {
    if (bottles[i].length !== CAP) return `Bottle ${i+1} must have exactly ${CAP} layers (full).`;
  }

  const counts = new Map();
  for (const c of colors) counts.set(c, 0);
  for (const b of bottles) for (const c of b) {
    if (!counts.has(c)) return `Color "${c}" is used but not selected in the checklist.`;
    counts.set(c, counts.get(c) + 1);
  }
  for (const c of colors) {
    const k = counts.get(c) || 0;
    if (k !== CAP) return `Color "${c}" appears ${k} times, but must appear exactly ${CAP} times.`;
  }

  return null;
}

function formatState(state) {
  let out = "";
  for (let i = 0; i < state.length; i++) {
    const b = state[i];
    const topToBottom = b.slice().reverse();
    const padded = topToBottom.concat(Array(CAP - topToBottom.length).fill("·"));
    out += `${String(i+1).padStart(2," ")}: ${padded.join("  ")}\n`;
  }
  return out;
}

function applyMove(state, move) {
  const next = cloneState(state);
  const res = doPour(next[move.from], next[move.to]);
  next[move.from] = res.newSrc;
  next[move.to] = res.newDst;
  return next;
}

// ---------- Wiring ----------
buildChecklist();

el("resetBtn").addEventListener("click", resetAll);

el("numBottles").addEventListener("change", () => {
  let v = parseInt(el("numBottles").value, 10);
  if (v > 14) v = 14;
  if (v < 3) v = 3;
  el("numBottles").value = v;
  updateColorLimitUI();
  updateSolveEnabled();
});

el("buildBtn").addEventListener("click", () => {
  updateColorLimitUI();
  buildBottlesUI();
});

el("solveBtn").addEventListener("click", () => {
  el("error").textContent = "";
  el("success").textContent = "";
  try {
    const bottles = readStateFromUI();
    const err = validateInput(bottles);
    if (err) return showError(err);

    el("output").textContent = "Solving...\n";
    el("status").textContent = "Starting search...";
    const t0 = performance.now();
    const result = bfsSolve(bottles, 400000);
    const t1 = performance.now();

    if (!result.ok) {
      showError(`Failed: ${result.reason}`);
      el("output").textContent =
        `Failed: ${result.reason}\nExplored: ${result.explored.toLocaleString()} states\nTime: ${(t1-t0).toFixed(0)} ms`;
      return;
    }

    showSuccess(`Solved! Moves: ${result.moves.length}. Explored: ${result.explored.toLocaleString()} states. Time: ${(t1-t0).toFixed(0)} ms`);
    el("status").textContent = "Done.";

    const showStates = el("showStates").checked;
    const shortMoves = el("shortMoves").checked;

    let text = "";
    text += `Initial state (top→bottom):\n${formatState(bottles)}\n`;
    let cur = bottles;

    result.moves.forEach((m, idx) => {
      const line = shortMoves
        ? `${idx+1}. ${m.from+1} → ${m.to+1}`
        : `${idx+1}. ${m.from+1} → ${m.to+1}  (poured ${m.amt} × ${m.color})`;
      text += line + "\n";
      cur = applyMove(cur, m);
      if (showStates) text += formatState(cur) + "\n";
    });

    el("output").textContent = text;

  } catch (e) {
    showError(String(e?.message || e));
  }
});
