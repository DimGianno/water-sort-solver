// solverCore.js
// Pure A* solver (no DOM). Bottles are arrays bottom->top (top is the last element).

export const CAP = 4;

function isUniform(b) {
  for (let i = 1; i < b.length; i++) if (b[i] !== b[0]) return false;
  return true;
}

function isSolved(state) {
  for (const b of state) {
    if (b.length === 0) continue;
    if (b.length !== CAP) return false;
    if (!isUniform(b)) return false;
  }
  return true;
}

function topRun(b) {
  if (b.length === 0) return null;
  const c = b[b.length - 1];
  let run = 1;
  for (let i = b.length - 2; i >= 0; i--) {
    if (b[i] === c) run++;
    else break;
  }
  return { color: c, run };
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

function cloneState(state) {
  return state.map(b => b.slice());
}

function bottleKey(b) {
  return b.join(",");
}

function stateKey(state) {
  return state.map(bottleKey).join("|");
}

function usefulMovePrune(src, dst) {
  // don’t pour a full uniform bottle into an empty bottle (usually useless)
  if (dst.length === 0 && src.length === CAP && isUniform(src)) return false;
  return true;
}

class MinHeap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  push(x) {
    this.a.push(x);
    this._up(this.a.length - 1);
  }
  pop() {
    if (!this.a.length) return null;
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

function heuristic(state, mode) {
  let h = 0;

  // bottle “messiness”
  for (const b of state) {
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

  const w = mode === "fast" ? 1.35 : 1.0;
  return Math.max(0, Math.floor(h * w));
}

function scoreMove(state, mv, mode) {
  const src = state[mv.from];
  const dst = state[mv.to];
  let s = 0;
  if (dst.length && dst[dst.length - 1] === src[src.length - 1]) s += 40;
  s += mv.amt * 6;
  if (dst.length + mv.amt === CAP) s += 30;
  const tr = topRun(src);
  if (tr && mv.amt >= tr.run) s += 18;
  if (dst.length === 0) s -= (mode === "optimal" ? 4 : 1);
  return s;
}

function generateMoves(state, mode, lastMove) {
  const n = state.length;
  const moves = [];
  const emptyIndex = state.findIndex(b => b.length === 0);
  const dstSigSeen = new Set();

  for (let i = 0; i < n; i++) {
    const src = state[i];
    if (!src.length) continue;

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

  moves.sort((a, b) => scoreMove(state, b, mode) - scoreMove(state, a, mode));
  return moves;
}

export function applyMove(state, mv) {
  const next = cloneState(state);
  const res = doPour(next[mv.from], next[mv.to]);
  next[mv.from] = res.newSrc;
  next[mv.to] = res.newDst;
  return next;
}

export function solveAStar(startState, mode = "fast") {
  const maxExp = mode === "fast" ? 1600000 : 2400000;

  const start = cloneState(startState);
  const startKey = stateKey(start);

  const bestG = new Map();
  bestG.set(startKey, 0);

  const parent = new Map();
  parent.set(startKey, null);

  const open = new MinHeap();
  open.push({ key: startKey, state: start, g: 0, f: heuristic(start, mode) });

  let expanded = 0;

  while (open.size() > 0) {
    const node = open.pop();
    if (!node) break;

    const knownG = bestG.get(node.key);
    if (knownG !== node.g) continue;

    expanded++;
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

  return { ok: false, reason: "No solution found.", explored: expanded };
}
