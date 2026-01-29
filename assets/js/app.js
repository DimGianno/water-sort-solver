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

  // ---------- State ----------
  let bottleLayers = [];         // [b][layerTopToBottom] => color or ""
  let selectedLayer = null;      // {b,l}
  let inputHistory = [];         // {b,l,prev,next}
  let lastSolution = null;       // {moves, states}
  let replayTimer = null;
  let replayIndex = 0;

  let openPopoverBottle = null;  // b index or null

  function showError(msg) { el("error").textContent = msg || ""; el("success").textContent = ""; }
  function showSuccess(msg) { el("success").textContent = msg || ""; el("error").textContent = ""; }

  function selectedColors() {
    return Array.from(el("colorChecklist").querySelectorAll("input[type=checkbox]:checked"))
      .map(x => x.value);
  }

  function colorMaxAllowed() {
    const n = parseInt(el("numBottles").value, 10);
    return Math.max(1, Math.min(12, n - 2));
  }

  function updateSelectAllVisibility() {
    const n = parseInt(el("numBottles").value, 10);
    el("selectAllBtn").style.display = (n === 14) ? "inline-block" : "none";
  }

  function updateColorLimitUI() {
    const max = colorMaxAllowed();
    const chosen = selectedColors().length;
    el("colorLimitHint").textContent = `Selected ${chosen}/${max} colors.`;

    const checkboxes = Array.from(el("colorChecklist").querySelectorAll("input[type=checkbox]"));
    const lock = chosen >= max;
    for (const cb of checkboxes) cb.disabled = (!cb.checked && lock);
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
        const max = colorMaxAllowed();
        const chosen = selectedColors().length;
        if (chosen > max) cb.checked = false;

        updateColorLimitUI();
        if (bottleLayers.length) {
          renderAllLayers();
          runContinuousValidation();
          updateSolveEnabled();
          renderPopover(openPopoverBottle);
        }
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

    updateSelectAllVisibility();
    updateColorLimitUI();
  }

  function selectAllColors() {
    // Only intended when n=14 (maxColors=12)
    const n = parseInt(el("numBottles").value, 10);
    if (n !== 14) return;
    el("colorChecklist").querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.checked = true;
      cb.disabled = false;
    });
    updateColorLimitUI();
    if (bottleLayers.length) {
      renderAllLayers();
      runContinuousValidation();
      updateSolveEnabled();
      renderPopover(openPopoverBottle);
    }
  }

  function resetAll() {
    el("numBottles").value = 11;
    el("showStates").checked = true;
    el("shortMoves").checked = false;
    el("modeSel").value = "fast";

    el("colorChecklist").querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.checked = false; cb.disabled = false;
    });

    bottleLayers = [];
    selectedLayer = null;
    inputHistory = [];
    lastSolution = null;

    el("bottleArea").innerHTML = "";
    el("buildMsg").textContent = "";
    el("status").textContent = "";
    el("validationMsg").textContent = "";
    el("error").textContent = "";
    el("success").textContent = "";
    el("output").textContent = "Build bottles UI, enter colors, then press Solve.";
    el("solveBtn").disabled = true;
    el("undoBtn").disabled = true;

    hideIO();
    hideReplay();

    openPopoverBottle = null;

    updateSelectAllVisibility();
    updateColorLimitUI();
  }

  // ---------- Build bottles UI ----------
  function buildBottlesUI() {
    const n = parseInt(el("numBottles").value, 10);
    const colors = selectedColors();

    showError("");
    showSuccess("");
    el("validationMsg").textContent = "";

    if (!Number.isFinite(n) || n < 3) return showError("Number of bottles must be >= 3.");
    if (n > 14) return showError("Max bottles is 14.");

    const maxColors = n - 2;
    if (colors.length === 0) return showError("Select at least 1 color.");
    if (colors.length > maxColors) return showError(`Too many colors selected. Max is ${maxColors}.`);

    bottleLayers = Array.from({length:n}, () => Array.from({length:CAP}, () => ""));
    selectedLayer = null;
    inputHistory = [];
    lastSolution = null;
    openPopoverBottle = null;

    el("undoBtn").disabled = true;
    hideReplay();

    const area = el("bottleArea");
    area.innerHTML = "";

    for (let i = 0; i < n; i++) {
      const isHelperEmpty = (i >= n - 2);

      const card = document.createElement("div");
      card.className = "bottle";
      card.dataset.bottle = String(i);

      const title = document.createElement("h3");
      title.innerHTML = `<span>Bottle ${i+1}</span><span class="small">${isHelperEmpty ? "EMPTY" : ""}</span>`;
      card.appendChild(title);

      const layers = document.createElement("div");
      layers.className = "layers";

      for (let l = 0; l < CAP; l++) {
        const layer = document.createElement("div");
        layer.className = "layer empty";
        layer.dataset.bottle = String(i);
        layer.dataset.layer = String(l);
        layer.innerHTML = `<span class="tag">Tap to set</span><span class="small">${l===0?"TOP":(l===3?"BOTTOM":"")}</span>`;

        if (isHelperEmpty) {
          layer.style.cursor = "not-allowed";
          layer.style.opacity = "0.55";
          layer.innerHTML = `<span class="tag">Helper</span><span class="small">${l===0?"TOP":(l===3?"BOTTOM":"")}</span>`;
        } else {
          layer.addEventListener("click", () => onLayerClick(i, l));
        }

        layers.appendChild(layer);
      }

      const pop = document.createElement("div");
      pop.className = "popover";
      pop.id = `popover-${i}`;

      card.appendChild(layers);
      card.appendChild(pop);

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = isHelperEmpty ? "Helper bottle (forced empty)" : "Tap a layer: palette appears below this bottle.";
      card.appendChild(hint);

      area.appendChild(card);
    }

    el("buildMsg").textContent = `Built ${n} bottles (capacity fixed to 4).`;
    el("status").textContent = "Fill all non-helper bottles. Solve unlocks when input is valid.";
    el("output").textContent = "Ready.";

    renderAllLayers();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function onLayerClick(b, l) {
    const n = bottleLayers.length;
    if (!n) return;
    if (b >= n-2) return;

    closeAllPopovers();

    // click same selected layer => clear it
    if (selectedLayer && selectedLayer.b === b && selectedLayer.l === l) {
      setLayerColor(b, l, "", true);
      selectedLayer = null;
      openPopoverBottle = b;
      openPopover(b);
      renderAllLayers();
      renderPopover(b);
      runContinuousValidation();
      updateSolveEnabled();
      return;
    }

    selectedLayer = {b,l};
    openPopoverBottle = b;
    openPopover(b);
    renderAllLayers();
    renderPopover(b);
  }

  function openPopover(b) {
    const pop = el(`popover-${b}`);
    if (!pop) return;
    pop.classList.add("open");
  }

  function closeAllPopovers() {
    const area = el("bottleArea");
    area.querySelectorAll(".popover").forEach(p => p.classList.remove("open"));
  }

  function setLayerColor(b,l,color, pushHistory=false) {
    const prev = bottleLayers[b][l];
    if (prev === color) return;

    if (color) {
      const colors = selectedColors();
      if (!colors.includes(color)) return;

      const counts = computeUsedCounts();
      const effectiveUsed = (counts[color] || 0) - (prev === color ? 1 : 0);
      if (effectiveUsed >= CAP) return;
    }

    bottleLayers[b][l] = color;

    if (pushHistory) {
      inputHistory.push({b,l,prev,next:color});
      el("undoBtn").disabled = inputHistory.length === 0;
    }
  }

  function undoLastInput() {
    const rec = inputHistory.pop();
    if (!rec) return;
    bottleLayers[rec.b][rec.l] = rec.prev;
    el("undoBtn").disabled = inputHistory.length === 0;
    selectedLayer = null;

    renderAllLayers();
    runContinuousValidation();
    updateSolveEnabled();
    renderPopover(openPopoverBottle);
  }

  function renderAllLayers() {
    const area = el("bottleArea");
    if (!area || !bottleLayers.length) return;

    area.querySelectorAll(".layer").forEach(div => {
      const b = parseInt(div.dataset.bottle,10);
      const l = parseInt(div.dataset.layer,10);
      if (b >= bottleLayers.length-2) return;

      const color = bottleLayers[b][l] || "";
      div.classList.toggle("selected", !!selectedLayer && selectedLayer.b===b && selectedLayer.l===l);

      if (!color) {
        div.classList.add("empty");
        div.style.backgroundColor = "#fff";
        div.style.color = "#999";
        div.querySelector(".tag").textContent = "Tap to set";
      } else {
        div.classList.remove("empty");
        div.style.backgroundColor = COLOR_PALETTE[color] || "#ddd";
        div.style.color = (color==="Yellow"||color==="Light Blue"||color==="Light Green") ? "#111" : "#fff";
        div.querySelector(".tag").textContent = color;
      }
    });
  }

  function computeUsedCounts() {
    const counts = {};
    for (const c of DEFAULT_COLORS) counts[c] = 0;
    for (let b=0;b<bottleLayers.length;b++){
      if (b >= bottleLayers.length-2) continue;
      for (let l=0;l<CAP;l++){
        const v = bottleLayers[b][l];
        if (v) counts[v] = (counts[v]||0)+1;
      }
    }
    return counts;
  }

  function renderPopover(b) {
    if (b === null || b === undefined) return;
    const pop = el(`popover-${b}`);
    if (!pop) return;

    const colors = selectedColors();
    const counts = computeUsedCounts();

    if (!selectedLayer || selectedLayer.b !== b) {
      pop.innerHTML = "";
      return;
    }

    const curVal = bottleLayers[selectedLayer.b][selectedLayer.l] || "";

    pop.innerHTML = "";

    const top = document.createElement("div");
    top.className = "popover-top";

    const left = document.createElement("div");
    left.className = "small";
    left.textContent = `Bottle ${b+1} • Layer ${selectedLayer.l+1}`;

    const actions = document.createElement("div");
    actions.className = "popover-actions";

    const er = document.createElement("button");
    er.textContent = "Eraser";
    er.addEventListener("click", () => {
      setLayerColor(selectedLayer.b, selectedLayer.l, "", true);
      selectedLayer = null;
      openPopoverBottle = b;
      renderAllLayers();
      renderPopover(b);
      runContinuousValidation();
      updateSolveEnabled();
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => {
      selectedLayer = null;
      closeAllPopovers();
      renderAllLayers();
      renderPopover(b);
    });

    actions.appendChild(er);
    actions.appendChild(closeBtn);

    top.appendChild(left);
    top.appendChild(actions);
    pop.appendChild(top);

    const grid = document.createElement("div");
    grid.className = "palette-grid";

    for (const c of colors) {
      let remaining = CAP - (counts[c] || 0);
      if (curVal === c) remaining += 1;

      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "color-tile";
      tile.style.background = COLOR_PALETTE[c] || "#ccc";
      tile.disabled = (remaining <= 0);

      if (curVal === c) tile.classList.add("tile-outline");

      const badge = document.createElement("span");
      badge.className = "count-badge";
      badge.textContent = `${Math.max(0, remaining)}`;
      tile.appendChild(badge);

      tile.addEventListener("click", () => {
        setLayerColor(selectedLayer.b, selectedLayer.l, c, true);
        selectedLayer = null;
        openPopoverBottle = b;
        renderAllLayers();
        renderPopover(b);
        runContinuousValidation();
        updateSolveEnabled();
      });

      grid.appendChild(tile);
    }

    pop.appendChild(grid);
  }

  // ---------- Validation + Solve enabled ----------
  function readStateFromInput() {
    const n = bottleLayers.length;
    const bottles = [];
    for (let b=0;b<n;b++){
      const topToBottom = bottleLayers[b].slice();
      const filtered = topToBottom.filter(v => v !== "");
      const bottomToTop = filtered.slice().reverse();
      bottles.push(bottomToTop);
    }
    return bottles;
  }

  function validateInput(bottles) {
    const n = bottles.length;
    const colors = selectedColors();
    if (!colors.length) return "Select colors first.";
    if (n < 3) return "Invalid bottle count.";
    if (bottles[n-1].length !== 0 || bottles[n-2].length !== 0) return "Last 2 bottles must be empty (helpers).";

    for (let i=0;i<n-2;i++){
      if (bottles[i].length !== CAP) return `Bottle ${i+1} must have exactly ${CAP} layers (fill all).`;
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

  function updateSolveEnabled() {
    if (!bottleLayers.length) { el("solveBtn").disabled = true; return; }
    const err = validateInput(readStateFromInput());
    el("solveBtn").disabled = !!err;
  }

  function runContinuousValidation() {
    if (!bottleLayers.length) { el("validationMsg").textContent = ""; return; }
    const err = validateInput(readStateFromInput());
    if (err) {
      el("validationMsg").textContent = "❌ " + err;
      el("validationMsg").style.color = "#b00020";
    } else {
      el("validationMsg").textContent = "✅ Input looks valid. You can solve.";
      el("validationMsg").style.color = "#0a7a22";
    }
  }

  // ---------- Import / Export ----------
  function toExportPayload() {
    const n = parseInt(el("numBottles").value, 10);
    const colors = selectedColors();
    const layers = bottleLayers.map(arr => arr.slice());
    return { v:1, n, colors, layers };
  }

  function encodeExport(obj) {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return "WS1:" + b64;
  }

  function decodeImport(code) {
    const trimmed = (code || "").trim();
    if (!trimmed.startsWith("WS1:")) throw new Error("Invalid code (missing WS1: prefix).");
    const b64 = trimmed.slice(4);
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    if (!obj || obj.v !== 1) throw new Error("Unsupported version.");
    return obj;
  }

  function showIO(mode) {
    el("ioArea").style.display = "block";
    el("ioMsg").textContent = "";
    el("ioText").value = "";
    el("ioApplyBtn").dataset.mode = mode;
  }

  function hideIO() {
    el("ioArea").style.display = "none";
    el("ioMsg").textContent = "";
    el("ioText").value = "";
  }

  function applyImport(obj) {
    if (!obj || typeof obj.n !== "number") throw new Error("Invalid payload.");

    const n = Math.max(3, Math.min(14, obj.n|0));
    el("numBottles").value = n;

    const max = n - 2;
    const want = Array.isArray(obj.colors) ? obj.colors.filter(c => DEFAULT_COLORS.includes(c)) : [];
    if (want.length > max) throw new Error(`Too many colors in import for ${n} bottles (max ${max}).`);

    el("colorChecklist").querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
    for (const c of want) {
      const cb = el("colorChecklist").querySelector(`input[type=checkbox][value="${CSS.escape(c)}"]`);
      if (cb) cb.checked = true;
    }

    updateSelectAllVisibility();
    updateColorLimitUI();

    buildBottlesUI();

    if (!Array.isArray(obj.layers) || obj.layers.length !== n) throw new Error("Invalid layers in payload.");
    for (let b=0;b<n;b++){
      for (let l=0;l<CAP;l++){
        const v = obj.layers[b]?.[l] || "";
        bottleLayers[b][l] = (want.includes(v) ? v : "");
      }
    }

    selectedLayer = null;
    inputHistory = [];
    el("undoBtn").disabled = true;

    renderAllLayers();
    runContinuousValidation();
    updateSolveEnabled();
    renderPopover(openPopoverBottle);
  }

  function onExport() {
    if (!bottleLayers.length) return showError("Build bottles UI first.");
    const code = encodeExport(toExportPayload());
    showIO("export");
    el("ioText").value = code;
    el("ioMsg").textContent = "Export ready. Copy it.";
  }

  function onImport() {
    showIO("import");
    el("ioText").value = "";
    el("ioMsg").textContent = "Paste code and press Apply.";
  }

  function onIOApply() {
    const mode = el("ioApplyBtn").dataset.mode || "import";
    if (mode === "export") {
      el("ioMsg").textContent = "Copy the code above.";
      return;
    }
    try {
      const obj = decodeImport(el("ioText").value);
      applyImport(obj);
      el("ioMsg").textContent = "Imported successfully.";
    } catch (e) {
      el("ioMsg").textContent = "Import failed: " + (e?.message || String(e));
    }
  }

  // ---------- Solver + Replay (unchanged) ----------
  function isSolved(state) {
    for (const b of state) {
      if (b.length === 0) continue;
      if (b.length !== CAP) return false;
      const c0 = b[0];
      for (let i = 1; i < b.length; i++) if (b[i] !== c0) return false;
    }
    return true;
  }
  function isUniform(b) {
    if (b.length === 0) return true;
    for (let i = 1; i < b.length; i++) if (b[i] !== b[0]) return false;
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
  function cloneState(state) { return state.map(b => b.slice()); }
  function bottleKey(b) { return b.join(","); }
  function canonicalKey(state) { return state.map(bottleKey).sort().join("|"); }
  function usefulMovePrune(src, dst) {
    if (dst.length === 0 && src.length === CAP && isUniform(src)) return false;
    return true;
  }

  class MinHeap {
    constructor() { this.a = []; }
    size() { return this.a.length; }
    push(x) { this.a.push(x); this._up(this.a.length - 1); }
    pop() {
      if (this.a.length === 0) return null;
      const root = this.a[0];
      const last = this.a.pop();
      if (this.a.length) { this.a[0] = last; this._down(0); }
      return root;
    }
    _up(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.a[p].f <= this.a[i].f) break;
        [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
        i = p;
      }
    }
    _down(i) {
      const n = this.a.length;
      while (true) {
        let l = i * 2 + 1, r = l + 1, m = i;
        if (l < n && this.a[l].f < this.a[m].f) m = l;
        if (r < n && this.a[r].f < this.a[m].f) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
  }

  function heuristic(state, mode) {
    let h = 0;
    const present = new Map();
    for (const b of state) {
      const seen = new Set(b);
      for (const c of seen) present.set(c, (present.get(c) || 0) + 1);
    }
    for (const b of state) {
      if (b.length === 0) continue;
      if (b.length === CAP && isUniform(b)) continue;
      let seg = 1;
      for (let i = 1; i < b.length; i++) if (b[i] !== b[i-1]) seg++;
      h += (seg - 1) * 2;
      if (b.length < CAP) h += 1;
      const tr = topRun(b);
      if (tr) {
        if (tr.run === 3) h -= 2;
        else if (tr.run === 2) h -= 1;
      }
    }
    for (const [,k] of present) if (k > 1) h += (k - 1);
    const w = (mode === "fast") ? 1.35 : 1.0;
    return Math.max(0, Math.floor(h * w));
  }

  function scoreMove(state, mv, mode) {
    const src = state[mv.from];
    const dst = state[mv.to];
    let s = 0;
    if (dst.length > 0 && dst[dst.length - 1] === src[src.length - 1]) s += 40;
    s += mv.amt * 6;
    const dstAfter = dst.length + mv.amt;
    if (dstAfter === CAP) s += 30;
    const tr = topRun(src);
    if (tr && mv.amt >= tr.run) s += 18;
    if (mode === "optimal") { if (dst.length === 0) s -= 4; }
    else { if (dst.length === 0) s -= 1; }
    return s;
  }

  function generateMoves(state, mode, lastMove) {
    const n = state.length;
    const moves = [];
    const emptyIndex = state.findIndex(b => b.length === 0);
    const dstSigSeen = new Set();

    for (let i = 0; i < n; i++) {
      const src = state[i];
      if (src.length === 0) continue;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (lastMove && lastMove.from === j && lastMove.to === i) continue;
        const dst = state[j];
        if (dst.length === 0 && emptyIndex !== -1 && j !== emptyIndex) continue;
        if (!canPour(src, dst)) continue;
        if (!usefulMovePrune(src, dst)) continue;

        const srcTop = src[src.length - 1];
        const sig = bottleKey(dst) + "|" + srcTop;
        if (dstSigSeen.has(sig)) continue;
        dstSigSeen.add(sig);

        const res = doPour(src, dst);
        moves.push({ from: i, to: j, amt: res.amt, color: res.color });
      }
    }
    moves.sort((a,b) => scoreMove(state, b, mode) - scoreMove(state, a, mode));
    return moves;
  }

  function applyMove(state, mv) {
    const next = cloneState(state);
    const res = doPour(next[mv.from], next[mv.to]);
    next[mv.from] = res.newSrc;
    next[mv.to] = res.newDst;
    return next;
  }

  function aStarSolve(startState, mode) {
    const maxExp = (mode === "fast") ? 1600000 : 2400000;
    const startKey = canonicalKey(startState);

    const bestG = new Map();
    bestG.set(startKey, 0);

    const parent = new Map();
    parent.set(startKey, null);

    const open = new MinHeap();
    open.push({ key: startKey, state: startState, g: 0, f: heuristic(startState, mode) });

    let expanded = 0;

    while (open.size() > 0) {
      const node = open.pop();
      if (!node) break;

      const knownG = bestG.get(node.key);
      if (knownG !== node.g) continue;

      expanded++;
      if (expanded % 5000 === 0) {
        el("status").textContent = `Searching (A* ${mode})... expanded ${expanded.toLocaleString()} states`;
      }
      if (expanded > maxExp) {
        return { ok:false, reason:`State limit reached (${maxExp.toLocaleString()}).`, explored: expanded };
      }

      if (isSolved(node.state)) {
        const moves = [];
        let k = node.key;
        while (parent.get(k) !== null) {
          const rec = parent.get(k);
          moves.push(rec.move);
          k = rec.prevKey;
        }
        moves.reverse();
        return { ok:true, moves, explored: expanded };
      }

      const lastRec = parent.get(node.key);
      const lastMove = lastRec ? lastRec.move : null;

      const moves = generateMoves(node.state, mode, lastMove);
      for (const mv of moves) {
        const next = applyMove(node.state, mv);
        const key2 = canonicalKey(next);
        const g2 = node.g + 1;

        const prev = bestG.get(key2);
        if (prev !== undefined && prev <= g2) continue;

        bestG.set(key2, g2);
        parent.set(key2, { prevKey: node.key, move: mv });

        const f2 = g2 + heuristic(next, mode);
        open.push({ key: key2, state: next, g: g2, f: f2 });
      }
    }

    return { ok:false, reason:"No solution found (input may be invalid).", explored: expanded };
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

  // ---------- Replay ----------
  function hideReplay() {
    el("replay").style.display = "none";
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    replayIndex = 0;
  }

  function showReplay(solution) {
    lastSolution = solution;
    replayIndex = 0;
    el("replay").style.display = "block";
    el("pauseBtn").disabled = true;
    el("playBtn").disabled = false;
    renderReplay();
  }

  function renderReplay() {
    if (!lastSolution) return;
    const states = lastSolution.states;
    const moves = lastSolution.moves;

    const stepMax = states.length - 1;
    el("stepLabel").textContent = `Step ${replayIndex}/${stepMax}`;

    const speed = parseFloat(el("speedRange").value);
    el("speedLabel").textContent = `${speed}×`;

    let hlFrom = -1, hlTo = -1;
    if (replayIndex > 0 && moves[replayIndex - 1]) {
      hlFrom = moves[replayIndex - 1].from;
      hlTo = moves[replayIndex - 1].to;
    }

    const grid = el("replayGrid");
    grid.innerHTML = "";

    const st = states[replayIndex];
    for (let i=0;i<st.length;i++){
      const rb = document.createElement("div");
      rb.className = "rbottle" + ((i===hlFrom || i===hlTo) ? " hl" : "");
      const t = document.createElement("div");
      t.className = "title";
      t.innerHTML = `<span>Bottle ${i+1}</span><span class="small">${(i===hlFrom?"FROM":(i===hlTo?"TO":""))}</span>`;
      rb.appendChild(t);

      const stack = document.createElement("div");
      stack.className = "rstack";

      const topToBottom = st[i].slice().reverse();
      const padded = topToBottom.concat(Array(CAP-topToBottom.length).fill(""));
      for (let l=0;l<CAP;l++){
        const seg = document.createElement("div");
        seg.className = "rseg";
        const c = padded[l];
        if (c) seg.style.background = COLOR_PALETTE[c] || "#ddd";
        else { seg.style.background = "#fff"; seg.style.borderStyle = "dashed"; }
        stack.appendChild(seg);
      }

      rb.appendChild(stack);
      grid.appendChild(rb);
    }

    el("prevStepBtn").disabled = (replayIndex === 0);
    el("nextStepBtn").disabled = (replayIndex === stepMax);
  }

  function stepPrev() { if (!lastSolution) return; replayIndex = Math.max(0, replayIndex-1); renderReplay(); }
  function stepNext() { if (!lastSolution) return; replayIndex = Math.min(lastSolution.states.length-1, replayIndex+1); renderReplay(); }

  function playReplay() {
    if (!lastSolution) return;
    if (replayTimer) return;

    el("playBtn").disabled = true;
    el("pauseBtn").disabled = false;

    const tick = () => {
      const speed = parseFloat(el("speedRange").value);
      const interval = Math.max(80, Math.floor(600 / speed));
      if (replayTimer) { clearInterval(replayTimer); replayTimer = setInterval(tick, interval); }

      if (replayIndex >= lastSolution.states.length-1) { pauseReplay(); return; }
      replayIndex++;
      renderReplay();
    };

    const speed = parseFloat(el("speedRange").value);
    const interval = Math.max(80, Math.floor(600 / speed));
    replayTimer = setInterval(tick, interval);
  }

  function pauseReplay() {
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    el("playBtn").disabled = false;
    el("pauseBtn").disabled = true;
  }

  function solve() {
    showError("");
    showSuccess("");

    if (!bottleLayers.length) return;

    const bottles = readStateFromInput();
    const err = validateInput(bottles);
    if (err) return showError(err);

    const mode = el("modeSel").value === "optimal" ? "optimal" : "fast";

    hideReplay();
    el("output").textContent = `Solving with A* (${mode})...\n`;
    el("status").textContent = "Starting search...";
    const t0 = performance.now();

    const result = aStarSolve(bottles, mode);
    const t1 = performance.now();

    if (!result.ok) {
      showError(`Failed: ${result.reason}`);
      el("output").textContent =
        `Failed: ${result.reason}\nExpanded: ${result.explored.toLocaleString()} states\nTime: ${(t1-t0).toFixed(0)} ms`;
      return;
    }

    showSuccess(`Solved! Moves: ${result.moves.length}. Expanded: ${result.explored.toLocaleString()} states. Time: ${(t1-t0).toFixed(0)} ms`);
    el("status").textContent = "Done.";

    const showStates = el("showStates").checked;
    const shortMoves = el("shortMoves").checked;

    let text = "";
    text += `Initial state (top→bottom):\n${formatState(bottles)}\n`;

    const states = [cloneState(bottles)];
    let cur = bottles;

    result.moves.forEach((m, idx) => {
      const line = shortMoves
        ? `${idx+1}. ${m.from+1} → ${m.to+1}`
        : `${idx+1}. ${m.from+1} → ${m.to+1}  (poured ${m.amt} × ${m.color})`;
      text += line + "\n";
      cur = applyMove(cur, m);
      states.push(cloneState(cur));
      if (showStates) text += formatState(cur) + "\n";
    });

    el("output").textContent = text;
    showReplay({ moves: result.moves, states });
  }

  // ---------- Wiring ----------
  buildChecklist();

  el("resetBtn").addEventListener("click", resetAll);
  el("undoBtn").addEventListener("click", undoLastInput);
  el("buildBtn").addEventListener("click", buildBottlesUI);

  el("exportBtn").addEventListener("click", onExport);
  el("importBtn").addEventListener("click", onImport);
  el("ioApplyBtn").addEventListener("click", onIOApply);
  el("ioCloseBtn").addEventListener("click", hideIO);

  el("solveBtn").addEventListener("click", solve);

  el("prevStepBtn").addEventListener("click", stepPrev);
  el("nextStepBtn").addEventListener("click", stepNext);
  el("playBtn").addEventListener("click", playReplay);
  el("pauseBtn").addEventListener("click", pauseReplay);
  el("speedRange").addEventListener("input", () => {
    el("speedLabel").textContent = `${el("speedRange").value}×`;
    if (replayTimer) { pauseReplay(); playReplay(); }
  });

  el("selectAllBtn").addEventListener("click", selectAllColors);

  el("numBottles").addEventListener("change", () => {
    let v = parseInt(el("numBottles").value, 10);
    if (v > 14) v = 14;
    if (v < 3) v = 3;
    el("numBottles").value = v;

    // enforce max colors = bottles - 2
    const max = colorMaxAllowed();
    const checked = Array.from(el("colorChecklist").querySelectorAll("input[type=checkbox]:checked"));
    if (checked.length > max) for (let k = max; k < checked.length; k++) checked[k].checked = false;

    updateSelectAllVisibility();
    updateColorLimitUI();

    if (bottleLayers.length) {
      runContinuousValidation();
      updateSolveEnabled();
      renderPopover(openPopoverBottle);
    }
  });
