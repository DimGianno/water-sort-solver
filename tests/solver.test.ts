import { expect, test } from "vitest";

import { CAP, SAMPLE_PUZZLE } from "../assets/js/constants.ts";
import { aStarSolve } from "../assets/js/solver-core.ts";
import { createSolver } from "../assets/js/solver.ts";
import type {
  PuzzleState,
  ReplaySolution,
  SolveWorkerRequest,
  SolverMode,
  SolverWorkerMessage,
} from "../assets/js/solver-types.ts";

class FakeWorker {
  autoSolve: boolean;
  messages: SolveWorkerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<SolverWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(autoSolve = true) {
    this.autoSolve = autoSolve;
  }

  postMessage(message: SolveWorkerRequest): void {
    this.messages.push(message);
    if (!this.autoSolve) return;
    queueMicrotask(() => {
      const result = aStarSolve(message.bottles, message.mode, {
        cap: message.cap,
      });
      this.emit({ type: "result", requestId: message.requestId, result });
    });
  }

  emit(data: SolverWorkerMessage): void {
    this.onmessage?.({ data } as MessageEvent<SolverWorkerMessage>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

interface FixtureOptions {
  mode?: SolverMode;
  previousReplay?: ReplaySolution | null;
  autoSolve?: boolean;
  validationError?: string | null;
}

function createFixture(bottles: PuzzleState, options: FixtureOptions = {}) {
  const elements = {
    modeSel: { value: options.mode || "fast" },
    shortMoves: { checked: false },
    showStates: { checked: false },
    output: { textContent: "Previous solution" },
    status: { textContent: "Done." },
    solveBtn: {
      textContent: "Solve puzzle",
      disabled: false,
      attributes: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
    },
  };
  const state = {
    bottleLayers: bottles.map((bottle) => bottle.slice()),
    selectedLayer: 1,
    openPopoverBottle: 2,
    isSolving: false,
    revealReplayOnSolve: false,
  };
  const messages = {
    errors: [] as string[],
    successes: [] as string[],
    replay: options.previousReplay ?? null,
  };
  const worker = new FakeWorker(options.autoSolve !== false);
  const solver = createSolver({
    CAP,
    state,
    el: (id: string) => elements[id as keyof typeof elements],
    showError: (message: string) => messages.errors.push(message),
    showSuccess: (message: string) => messages.successes.push(message),
    readStateFromInput: () => bottles.map((bottle) => bottle.slice()),
    validateCurrentInput: () => options.validationError || null,
    closeAllPopovers: () => {},
    renderAllLayers: () => {},
    showReplay: (replay: ReplaySolution) => {
      messages.replay = replay;
    },
    updateSolveEnabled: () => {
      elements.solveBtn.disabled = Boolean(options.validationError);
    },
    createWorker: () => worker as unknown as Worker,
  } as unknown as Parameters<typeof createSolver>[0]);

  return { elements, messages, solver, state, worker };
}

function isSolved(bottles: PuzzleState): boolean {
  return bottles.every(
    (bottle) =>
      bottle.length === 0 ||
      (bottle.length === CAP && bottle.every((color) => color === bottle[0])),
  );
}

const nextTurn = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

test("the solver core preserves valid results in both search modes", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];

  for (const mode of ["fast", "optimal"] as const) {
    const result = aStarSolve(bottles, mode, { cap: CAP });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    let current = bottles;
    for (const move of result.moves) {
      const source = current[move.from].slice(0, -move.amt);
      const destination = current[move.to].concat(
        Array(move.amt).fill(move.color),
      );
      current = current.map((bottle, index) =>
        index === move.from ? source : index === move.to ? destination : bottle,
      );
    }
    expect(isSolved(current)).toBe(true);
  }
});

test("the curated sample demonstrates the fast versus optimal-ish tradeoff", () => {
  const bottles = SAMPLE_PUZZLE.layers.map((layers) =>
    layers.filter(Boolean).reverse(),
  );
  const fast = aStarSolve(bottles, "fast", { cap: CAP });
  const optimal = aStarSolve(bottles, "optimal", { cap: CAP });

  expect(fast.ok).toBe(true);
  expect(optimal.ok).toBe(true);
  if (!fast.ok || !optimal.ok) throw new Error("Expected both modes to solve");
  expect(fast.moves.length).toBeGreaterThan(optimal.moves.length);
  expect(optimal.explored).toBeGreaterThan(fast.explored * 5);
});

test("solve recognizes an already solved puzzle through the worker", async () => {
  const bottles = [
    ["Red", "Red", "Red", "Red"],
    ["Blue", "Blue", "Blue", "Blue"],
    [],
    [],
  ];
  const { elements, messages, solver } = createFixture(bottles);

  solver.solve();
  await nextTurn();

  expect(elements.output.textContent).toBe("Already solved.");
  expect(elements.status.textContent).toBe("Done.");
  expect(messages.replay).not.toBeNull();
  expect(messages.replay?.moves).toEqual([]);
  expect(messages.replay?.states).toEqual([bottles]);
  expect(messages.successes.at(-1)).toMatch(/^Solved! Moves: 0\./);
});

test("solve returns a valid replay sequence through the worker", async () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];
  const { messages, solver } = createFixture(bottles);

  solver.solve();
  await nextTurn();

  expect(messages.replay).not.toBeNull();
  if (!messages.replay) throw new Error("Expected a replay");
  expect(messages.replay.moves.length).toBeGreaterThan(0);
  expect(messages.replay.states.length).toBe(messages.replay.moves.length + 1);
  expect(messages.replay.states[0]).toEqual(bottles);
  const finalState = messages.replay.states.at(-1);
  expect(finalState).toBeDefined();
  if (!finalState) throw new Error("Expected a final replay state");
  expect(isSolved(finalState)).toBe(true);
});

test("solve reports progress and cancellation while ignoring stale results", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];
  const previousReplay: ReplaySolution = {
    moves: [{ from: 0, to: 1, amt: 1, color: "Red" }],
    states: [],
  };
  const { elements, messages, solver, state, worker } = createFixture(bottles, {
    autoSolve: false,
    previousReplay,
  });

  solver.solve();
  const request = worker.messages[0];
  expect(state.isSolving).toBe(true);
  expect(elements.solveBtn.textContent).toBe("Cancel search");
  expect(request).toEqual({
    type: "solve",
    requestId: 1,
    bottles,
    mode: "fast",
    cap: CAP,
  });

  worker.emit({
    type: "progress",
    requestId: request.requestId,
    expanded: 5000,
  });
  expect(elements.status.textContent).toMatch(/expanded 5[.,]000 states/);

  solver.cancelSolve();
  expect(worker.terminated).toBe(true);
  expect(state.isSolving).toBe(false);
  expect(elements.solveBtn.textContent).toBe("Solve puzzle");
  expect(elements.status.textContent).toBe("Search cancelled.");

  worker.emit({
    type: "result",
    requestId: request.requestId,
    result: { ok: true, moves: [], explored: 1 },
  });
  expect(messages.replay).toBe(previousReplay);
});

test("worker errors preserve the prior replay and restore controls", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];
  const previousReplay = { moves: [], states: [bottles] };
  const { elements, messages, solver, state, worker } = createFixture(bottles, {
    autoSolve: false,
    previousReplay,
  });

  solver.solve();
  worker.emit({ type: "error", requestId: 1, message: "Worker crashed." });

  expect(state.isSolving).toBe(false);
  expect(elements.solveBtn.textContent).toBe("Solve puzzle");
  expect(elements.status.textContent).toBe("Search failed.");
  expect(messages.replay).toBe(previousReplay);
  expect(messages.errors.at(-1)).toBe("Solver error: Worker crashed.");
});

test("solve surfaces validation errors without starting a worker", () => {
  const bottles = [[], [], [], []];
  const { messages, solver, worker } = createFixture(bottles, {
    validationError: "Select colors first.",
  });

  solver.solve();

  expect(messages.errors.at(-1)).toBe("Select colors first.");
  expect(worker.messages).toHaveLength(0);
});
