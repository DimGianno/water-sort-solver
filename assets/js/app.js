/**
 * Representation
 * - Each bottle is an array bottom->top, e.g. ["Blue","Blue","Red","Purple"] (top is last)
 * - Empty bottle is []
 * Rules:
 * - Can pour if src not empty, dst not full, and (dst empty or dst top == src top)
 * - When pouring, pour the largest contiguous block of src top color, limited by dst space
 */

(() => {
  const DEFAULT_COLORS = [
    "Red","Pink","Orange","Yellow","Green","Light Green","Blue","Light Blue","Purple","Gray","Brown","Black","White"
  ];

  const el = (id) => document.getElementById(id);

  function buildChecklist() {
    const box = el("colorChecklist");
    box.innerHTML = "";
    DEFAULT_COLORS.forEach((c) => {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" value="${c}"> <span>${c}</span>`;
      box.appendChild(lab);
    });
  }

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

  function buildBottlesUI() {
    const n = parseInt(el("numBottles").value, 10);
    const cap = parseInt(el("capacity").value, 10);

    const colors = selectedColors();
    el("error").textContent = "";
    el("success").textContent = "";

    if (!Number.isFinite(n) || n < 3) return showError("Number of bottles must be >= 3.");
    if (!Number.isFinite(cap) || cap < 2) return showError("Capacity must be >= 2.");
    if (colors.length === 0) return showError("Select at least 1 color.");

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

      // UI is top->bottom for the user
      for (let row = 0; row < cap; row++) {
        const sel = document.createElement("select");
        sel.dataset.layer = String(row); // 0 is top in UI
        if (isHelperEmpty) {
          sel.disabled = true;
          sel.innerHTML = `<option value="">(empty)</option>`;
        } else {
          sel.innerHTML = `<option value="">(empty)</option>` + colors.map(c => `<option value="${c}">${c}</option>`).join("");
        }
        layers.appendChild(sel);
      }

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = isHelperEmpty ? "Helper bottle (forced empty)" : "Set colors TOP → BOTTOM (leave empty if shorter)";
      b.appendChild(layers);
      b.appendChild(hint);

      area.appendChild(b);
    }

    el("buildMsg").textContent = `Built ${n} bottles with capacity ${cap}.`;
    el("status").textContent = "Enter the level, then press Solve.";
    el("output").textContent = "Ready.";
  }

  function readStateFromUI() {
    const n = parseInt(el("numBottles").value, 10);
    const cap = parseInt(el("capacity").value, 10);

    const bottles = [];
    for (let i = 0; i < n; i++) {
      const b = el("bottleArea").querySelector(`.bottle[data-index="${i}"]`);
      const selects = Array.from(b.querySelectorAll("select"));
      // selects are ordered top->bottom in UI
      const topToBottom = selects.map(s => s.value).filter(v => v !== "");
      // Convert to bottom->top for solver:
      const bottomToTop = topToBottom.slice().reverse();
      if (bottomToTop.length > cap) throw new Error("Bottle over capacity?");
      bottles.push(bottomToTop);
    }
    return { bottles, cap };
  }

  // ---------- Solver (BFS with pruning) ----------
  function isSolved(state, cap) {
    for (const b of state) {
      if (b.length === 0) continue;
      if (b.length !== cap) return false;
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

  function canPour(src, dst, cap) {
    if (src.length === 0) return false;
    if (dst.length >= cap) return false;
    if (dst.length === 0) return true;
    return dst[dst.length - 1] === src[src.length - 1];
  }

  function doPour(src, dst, cap) {
    const tr = topRun(src);
    const space = cap - dst.length;
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

  function usefulMovePrune(src, dst, cap) {
    if (dst.length === 0 && src.length === cap) {
      const c0 = src[0];
      let allSame = true;
      for (let i = 1; i < src.length; i++) if (src[i] !== c0) { allSame = false; break; }
      if (allSame) return false;
    }
    return true;
  }

  function bfsSolve(startState, cap, maxStates = 400000) {
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
        return { ok:false, reason:`State limit reached (${maxStates.toLocaleString()}). Try selecting fewer colors or reducing bottles.`, explored };
      }

      if (isSolved(state, cap)) {
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
      for (let i = 0; i < n; i++) {
        const src = state[i];
        if (src.length === 0) continue;

        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dst = state[j];
          if (!canPour(src, dst, cap)) continue;
          if (!usefulMovePrune(src, dst, cap)) continue;

          const next = cloneState(state);
          const res = doPour(next[i], next[j], cap);
          next[i] = res.newSrc;
          next[j] = res.newDst;

          const key = encodeState(next);
          if (!parent.has(key)) {
            parent.set(key, { prevKey: encodeState(state), move: { from:i, to:j, amt:res.amt, color:res.color } });
            q.push(next);
          }
        }
      }
    }

    return { ok:false, reason:"No solution found (this input may be invalid).", explored };
  }

  // ---------- Validation ----------
  function validateInput(bottles, cap) {
    const n = bottles.length;
    if (bottles[n-1].length !== 0 || bottles[n-2].length !== 0) {
      return "Last 2 bottles must be empty (they are helper bottles).";
    }
    for (let i = 0; i < n; i++) {
      if (bottles[i].length > cap) return `Bottle ${i+1} exceeds capacity.`;
    }
    const counts = new Map();
    for (const b of bottles) for (const c of b) counts.set(c, (counts.get(c)||0)+1);
    for (const [c, k] of counts.entries()) {
      if (k % cap !== 0) {
        return `Color "${c}" appears ${k} times, not a multiple of capacity (${cap}). This often means the level was entered incorrectly.`;
      }
    }
    return null;
  }

  function formatState(state, cap) {
    let out = "";
    for (let i = 0; i < state.length; i++) {
      const b = state[i];
      const topToBottom = b.slice().reverse();
      const padded = topToBottom.concat(Array(cap - topToBottom.length).fill("·"));
      out += `${String(i+1).padStart(2," ")}: ${padded.join("  ")}\n`;
    }
    return out;
  }

  function applyMove(state, move, cap) {
    const next = cloneState(state);
    const res = doPour(next[move.from], next[move.to], cap);
    next[move.from] = res.newSrc;
    next[move.to] = res.newDst;
    return next;
  }

  // ---------- UI wiring ----------
  buildChecklist();

  el("buildBtn").addEventListener("click", buildBottlesUI);

  el("solveBtn").addEventListener("click", () => {
    el("error").textContent = "";
    el("success").textContent = "";
    try {
      const { bottles, cap } = readStateFromUI();
      const err = validateInput(bottles, cap);
      if (err) return showError(err);

      const start = bottles;
      el("output").textContent = "Solving...\n";
      el("status").textContent = "Starting search...";
      const t0 = performance.now();
      const result = bfsSolve(start, cap, 1000000);
      const t1 = performance.now();

      if (!result.ok) {
        showError(result.reason);
        el("output").textContent = `Failed: ${result.reason}\nExplored: ${result.explored.toLocaleString()} states\nTime: ${(t1-t0).toFixed(0)} ms`;
        return;
      }

      showSuccess(`Solved! Moves: ${result.moves.length}. Explored: ${result.explored.toLocaleString()} states. Time: ${(t1-t0).toFixed(0)} ms`);
      el("status").textContent = "Done.";

      const showStates = el("showStates").checked;
      const shortMoves = el("shortMoves").checked;

      let text = "";
      text += `Initial state (top→bottom):\n${formatState(start, cap)}\n`;
      let cur = start;
      result.moves.forEach((m, idx) => {
        const line = shortMoves
          ? `${idx+1}. ${m.from+1} → ${m.to+1}`
          : `${idx+1}. ${m.from+1} → ${m.to+1}  (poured ${m.amt} × ${m.color})`;
        text += line + "\n";
        cur = applyMove(cur, m, cap);
        if (showStates) text += formatState(cur, cap) + "\n";
      });

      el("output").textContent = text;

    } catch (e) {
      showError(String(e?.message || e));
    }
  });

  el("exampleBtn").addEventListener("click", () => {
    el("numBottles").value = 11;
    el("capacity").value = 4;

    const needed = new Set(["Purple","Red","Blue","Pink","Orange","Green","Light Green","Light Blue","Gray"]);
    el("colorChecklist").querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = needed.has(cb.value));

    buildBottlesUI();

    const preset = [
      ["Purple","Red","Blue","Blue"],
      ["Pink","Orange","Blue","Light Green"],
      ["Green","Pink","Red","Purple"],
      ["Light Green","Gray","Green","Pink"],
      ["Orange","Gray","Light Green","Light Green"],
      ["Pink","Light Blue","Gray","Red"],
      ["Purple","Light Blue","Red","Blue"],
      ["Green","Purple","Gray","Light Blue"],
      ["Light Blue","Orange","Orange","Green"],
      [],
      []
    ];

    for (let i = 0; i < 11; i++) {
      const b = el("bottleArea").querySelector(`.bottle[data-index="${i}"]`);
      const selects = Array.from(b.querySelectorAll("select"));
      const arr = preset[i];
      for (let r = 0; r < selects.length; r++) {
        selects[r].value = arr[r] || "";
      }
    }

    el("output").textContent = "Example loaded. Press Solve.";
  });
})();
