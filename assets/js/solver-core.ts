import type {
  Bottle,
  Color,
  PuzzleState,
  SolverMode,
  SolverMove,
  SolverOptions,
  SolverResult,
} from "./solver-types.ts";

interface TopRun {
  color: Color;
  run: number;
}

interface PourResult {
  newSource: Bottle;
  newDestination: Bottle;
  amount: number;
  color: Color;
}

interface SearchNode {
  key: string;
  state: PuzzleState;
  g: number;
  f: number;
}

interface ParentRecord {
  previousKey: string;
  move: SolverMove;
}

export function cloneState(puzzleState: PuzzleState): PuzzleState {
  return puzzleState.map((bottle) => bottle.slice());
}

function isSolved(puzzleState: PuzzleState, cap: number): boolean {
  for (const bottle of puzzleState) {
    if (bottle.length === 0) continue;
    if (bottle.length !== cap) return false;
    const firstColor = bottle[0];
    for (let i = 1; i < bottle.length; i++) {
      if (bottle[i] !== firstColor) return false;
    }
  }
  return true;
}

function isUniform(bottle: Bottle): boolean {
  if (bottle.length === 0) return true;
  for (let i = 1; i < bottle.length; i++) {
    if (bottle[i] !== bottle[0]) return false;
  }
  return true;
}

function topRun(bottle: Bottle): TopRun | null {
  if (bottle.length === 0) return null;
  const color = bottle[bottle.length - 1];
  let run = 1;
  for (let i = bottle.length - 2; i >= 0; i--) {
    if (bottle[i] === color) run++;
    else break;
  }
  return { color, run };
}

function canPour(source: Bottle, destination: Bottle, cap: number): boolean {
  if (source.length === 0 || destination.length >= cap) return false;
  if (destination.length === 0) return true;
  return destination[destination.length - 1] === source[source.length - 1];
}

function doPour(source: Bottle, destination: Bottle, cap: number): PourResult {
  const run = topRun(source)!;
  const amount = Math.min(run.run, cap - destination.length);
  return {
    newSource: source.slice(0, source.length - amount),
    newDestination: destination.concat(Array<Color>(amount).fill(run.color)),
    amount,
    color: run.color,
  };
}

function bottleKey(bottle: Bottle): string {
  return bottle.join(",");
}

function stateKey(puzzleState: PuzzleState): string {
  return puzzleState.map(bottleKey).join("|");
}

class MinHeap<T extends { f: number }> {
  readonly #items: T[] = [];

  size(): number {
    return this.#items.length;
  }

  push(item: T): void {
    this.#items.push(item);
    this.#moveUp(this.#items.length - 1);
  }

  pop(): T | null {
    if (this.#items.length === 0) return null;
    const root = this.#items[0];
    const last = this.#items.pop()!;
    if (this.#items.length) {
      this.#items[0] = last;
      this.#moveDown(0);
    }
    return root;
  }

  #moveUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#items[parent].f <= this.#items[index].f) break;
      [this.#items[parent], this.#items[index]] = [
        this.#items[index],
        this.#items[parent],
      ];
      index = parent;
    }
  }

  #moveDown(index: number): void {
    const length = this.#items.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < length && this.#items[left].f < this.#items[smallest].f) {
        smallest = left;
      }
      if (right < length && this.#items[right].f < this.#items[smallest].f) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.#items[smallest], this.#items[index]] = [
        this.#items[index],
        this.#items[smallest],
      ];
      index = smallest;
    }
  }
}

function heuristic(
  puzzleState: PuzzleState,
  mode: SolverMode,
  cap: number,
): number {
  let score = 0;
  const present = new Map<Color, number>();
  for (const bottle of puzzleState) {
    for (const color of new Set(bottle)) {
      present.set(color, (present.get(color) || 0) + 1);
    }
  }

  for (const bottle of puzzleState) {
    if (bottle.length === 0 || (bottle.length === cap && isUniform(bottle))) {
      continue;
    }

    let segments = 1;
    for (let i = 1; i < bottle.length; i++) {
      if (bottle[i] !== bottle[i - 1]) segments++;
    }
    score += (segments - 1) * 2;
    if (bottle.length < cap) score += 1;

    const run = topRun(bottle);
    if (run?.run === 3) score -= 2;
    else if (run?.run === 2) score -= 1;
  }

  for (const count of present.values()) {
    if (count > 1) score += count - 1;
  }
  const weight = mode === "fast" ? 1.35 : 1;
  return Math.max(0, Math.floor(score * weight));
}

function scoreMove(
  puzzleState: PuzzleState,
  move: SolverMove,
  mode: SolverMode,
  cap: number,
): number {
  const source = puzzleState[move.from];
  const destination = puzzleState[move.to];
  let score = 0;
  if (
    destination.length > 0 &&
    destination[destination.length - 1] === source[source.length - 1]
  ) {
    score += 40;
  }
  score += move.amt * 6;
  if (destination.length + move.amt === cap) score += 30;
  const run = topRun(source);
  if (run && move.amt >= run.run) score += 18;
  if (mode === "optimal") {
    if (destination.length === 0) score -= 4;
  } else if (destination.length === 0) {
    score -= 1;
  }
  return score;
}

function generateMoves(
  puzzleState: PuzzleState,
  mode: SolverMode,
  lastMove: SolverMove | null,
  cap: number,
): SolverMove[] {
  const moves: SolverMove[] = [];
  const emptyIndex = puzzleState.findIndex((bottle) => bottle.length === 0);
  const destinationSignatures = new Set<string>();

  for (let from = 0; from < puzzleState.length; from++) {
    const source = puzzleState[from];
    if (source.length === 0) continue;

    for (let to = 0; to < puzzleState.length; to++) {
      if (
        from === to ||
        (lastMove && lastMove.from === to && lastMove.to === from)
      ) {
        continue;
      }
      const destination = puzzleState[to];
      if (destination.length === 0 && emptyIndex !== -1 && to !== emptyIndex) {
        continue;
      }
      if (!canPour(source, destination, cap)) continue;
      if (
        destination.length === 0 &&
        source.length === cap &&
        isUniform(source)
      ) {
        continue;
      }

      const signature =
        bottleKey(destination) + "|" + source[source.length - 1];
      if (destinationSignatures.has(signature)) continue;
      destinationSignatures.add(signature);

      const pour = doPour(source, destination, cap);
      moves.push({ from, to, amt: pour.amount, color: pour.color });
    }
  }

  moves.sort(
    (a, b) =>
      scoreMove(puzzleState, b, mode, cap) -
      scoreMove(puzzleState, a, mode, cap),
  );
  return moves;
}

export function applyMove(
  puzzleState: PuzzleState,
  move: SolverMove,
  cap = 4,
): PuzzleState {
  const next = cloneState(puzzleState);
  const pour = doPour(next[move.from], next[move.to], cap);
  next[move.from] = pour.newSource;
  next[move.to] = pour.newDestination;
  return next;
}

export function aStarSolve(
  startState: PuzzleState,
  mode: SolverMode,
  options: SolverOptions = {},
): SolverResult {
  const cap = options.cap ?? 4;
  const onProgress = options.onProgress ?? (() => {});
  const maxExpanded = mode === "fast" ? 1600000 : 2400000;
  const startKey = stateKey(startState);
  const bestCost = new Map<string, number>([[startKey, 0]]);
  const parents = new Map<string, ParentRecord | null>([[startKey, null]]);
  const open = new MinHeap<SearchNode>();
  open.push({
    key: startKey,
    state: startState,
    g: 0,
    f: heuristic(startState, mode, cap),
  });
  let expanded = 0;

  while (open.size() > 0) {
    const node = open.pop();
    if (!node) break;
    if (bestCost.get(node.key) !== node.g) continue;

    expanded++;
    if (expanded % 5000 === 0) onProgress(expanded);
    if (expanded > maxExpanded) {
      return {
        ok: false,
        reason: `State limit reached (${maxExpanded.toLocaleString()}).`,
        explored: expanded,
      };
    }

    if (isSolved(node.state, cap)) {
      const moves: SolverMove[] = [];
      let key = node.key;
      while (parents.get(key) !== null) {
        const record = parents.get(key)!;
        moves.push(record.move);
        key = record.previousKey;
      }
      moves.reverse();
      return { ok: true, moves, explored: expanded };
    }

    const lastRecord = parents.get(node.key);
    const moves = generateMoves(
      node.state,
      mode,
      lastRecord ? lastRecord.move : null,
      cap,
    );
    for (const move of moves) {
      const next = applyMove(node.state, move, cap);
      const nextKey = stateKey(next);
      const nextCost = node.g + 1;
      const previousCost = bestCost.get(nextKey);
      if (previousCost !== undefined && previousCost <= nextCost) continue;

      bestCost.set(nextKey, nextCost);
      parents.set(nextKey, { previousKey: node.key, move });
      open.push({
        key: nextKey,
        state: next,
        g: nextCost,
        f: nextCost + heuristic(next, mode, cap),
      });
    }
  }

  return {
    ok: false,
    reason: "No solution found (input may be invalid).",
    explored: expanded,
  };
}
