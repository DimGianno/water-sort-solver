export function createSolver(ctx) {
  const { CAP, state, el } = ctx;
  const {
    showError,
    showSuccess,
    readStateFromInput,
    validateInput,
    closeAllPopovers,
    renderAllLayers,
    hideReplay,
    showReplay,
  } = ctx;

  function isSolved(puzzleState) {
    for (const b of puzzleState) {
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

  function cloneState(puzzleState) {
    return puzzleState.map((b) => b.slice());
  }

  function bottleKey(b) {
    return b.join(",");
  }

  // Ordered key keeps parent/move reconstruction consistent with bottle indexes.
  function stateKey(puzzleState) {
    return puzzleState.map(bottleKey).join("|");
  }

  function usefulMovePrune(src, dst) {
    if (dst.length === 0 && src.length === CAP && isUniform(src)) return false;
    return true;
  }

  class MinHeap {
    constructor() {
      this.a = [];
    }
    size() {
      return this.a.length;
    }
    push(x) {
      this.a.push(x);
      this._up(this.a.length - 1);
    }
    pop() {
      if (this.a.length === 0) return null;
      const root = this.a[0];
      const last = this.a.pop();
      if (this.a.length) {
        this.a[0] = last;
        this._down(0);
      }
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
        let l = i * 2 + 1;
        let r = l + 1;
        let m = i;
        if (l < n && this.a[l].f < this.a[m].f) m = l;
        if (r < n && this.a[r].f < this.a[m].f) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
  }

  function heuristic(puzzleState, mode) {
    let h = 0;
    const present = new Map();
    for (const b of puzzleState) {
      const seen = new Set(b);
      for (const c of seen) present.set(c, (present.get(c) || 0) + 1);
    }
    for (const b of puzzleState) {
      if (b.length === 0) continue;
      if (b.length === CAP && isUniform(b)) continue;

      let seg = 1;
      for (let i = 1; i < b.length; i++) if (b[i] !== b[i - 1]) seg++;
      h += (seg - 1) * 2;

      if (b.length < CAP) h += 1;

      const tr = topRun(b);
      if (tr) {
        if (tr.run === 3) h -= 2;
        else if (tr.run === 2) h -= 1;
      }
    }
    for (const [, k] of present) if (k > 1) h += k - 1;
    const w = mode === "fast" ? 1.35 : 1.0;
    return Math.max(0, Math.floor(h * w));
  }

  function scoreMove(puzzleState, mv, mode) {
    const src = puzzleState[mv.from];
    const dst = puzzleState[mv.to];
    let s = 0;
    if (dst.length > 0 && dst[dst.length - 1] === src[src.length - 1]) s += 40;
    s += mv.amt * 6;
    const dstAfter = dst.length + mv.amt;
    if (dstAfter === CAP) s += 30;
    const tr = topRun(src);
    if (tr && mv.amt >= tr.run) s += 18;
    if (mode === "optimal") {
      if (dst.length === 0) s -= 4;
    } else if (dst.length === 0) {
      s -= 1;
    }
    return s;
  }

  function generateMoves(puzzleState, mode, lastMove) {
    const n = puzzleState.length;
    const moves = [];
    const emptyIndex = puzzleState.findIndex((b) => b.length === 0);
    const dstSigSeen = new Set();

    for (let i = 0; i < n; i++) {
      const src = puzzleState[i];
      if (src.length === 0) continue;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (lastMove && lastMove.from === j && lastMove.to === i) continue;

        const dst = puzzleState[j];
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

    moves.sort((a, b) => scoreMove(puzzleState, b, mode) - scoreMove(puzzleState, a, mode));
    return moves;
  }

  function applyMove(puzzleState, mv) {
    const next = cloneState(puzzleState);
    const res = doPour(next[mv.from], next[mv.to]);
    next[mv.from] = res.newSrc;
    next[mv.to] = res.newDst;
    return next;
  }

  function aStarSolve(startState, mode) {
    const maxExp = mode === "fast" ? 1600000 : 2400000;

    const startKey = stateKey(startState);
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
        return { ok: false, reason: `State limit reached (${maxExp.toLocaleString()}).`, explored: expanded };
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
        return { ok: true, moves, explored: expanded };
      }

      const lastRec = parent.get(node.key);
      const lastMove = lastRec ? lastRec.move : null;
      const moves = generateMoves(node.state, mode, lastMove);

      for (const mv of moves) {
        const next = applyMove(node.state, mv);
        const key2 = stateKey(next);
        const g2 = node.g + 1;

        const prev = bestG.get(key2);
        if (prev !== undefined && prev <= g2) continue;

        bestG.set(key2, g2);
        parent.set(key2, { prevKey: node.key, move: mv });

        const f2 = g2 + heuristic(next, mode);
        open.push({ key: key2, state: next, g: g2, f: f2 });
      }
    }

    return { ok: false, reason: "No solution found (input may be invalid).", explored: expanded };
  }

  function formatState(bottles) {
    return bottles
      .map((b, i) => {
        const val = b.length ? b.join(", ") : "empty";
        return `${i + 1}: [${val}]`;
      })
      .join("\n");
  }

  function solve() {
    showError("");
    showSuccess("");
    if (!state.bottleLayers.length) return;

    const bottles = readStateFromInput();
    const err = validateInput(bottles);
    if (err) return showError(err);

    const mode = el("modeSel").value === "optimal" ? "optimal" : "fast";
    const shortMoves = el("shortMoves").checked;
    const showStates = el("showStates").checked;

    state.selectedLayer = null;
    state.openPopoverBottle = null;
    closeAllPopovers();
    renderAllLayers();

    hideReplay();
    el("output").textContent = `Solving with A* (${mode})...\n`;
    el("status").textContent = "Starting search...";
    const t0 = performance.now();

    const result = aStarSolve(bottles, mode);
    const t1 = performance.now();

    if (!result.ok) {
      showError(`Failed: ${result.reason}`);
      el("output").textContent = `Failed: ${result.reason}\nExpanded: ${result.explored.toLocaleString()} states\nTime: ${(t1 - t0).toFixed(0)} ms`;
      return;
    }

    showSuccess(
      `Solved! Moves: ${result.moves.length}. Expanded: ${result.explored.toLocaleString()} states. Time: ${(t1 - t0).toFixed(0)} ms`
    );
    el("status").textContent = "Done.";

    const states = [cloneState(bottles)];
    let cur = bottles;
    result.moves.forEach((m) => {
      cur = applyMove(cur, m);
      states.push(cloneState(cur));
    });

    let text = "";
    result.moves.forEach((m, idx) => {
      const moveText = shortMoves
        ? `${idx + 1}. ${m.from + 1} -> ${m.to + 1}`
        : `${idx + 1}. ${m.from + 1} -> ${m.to + 1} (${m.amt} ${m.color})`;
      text += moveText + "\n";
      if (showStates) text += formatState(states[idx + 1]) + "\n\n";
    });

    if (!text) text = "Already solved.";
    el("output").textContent = text.trimEnd();
    showReplay({ moves: result.moves, states });
  }

  return {
    solve,
  };
}
