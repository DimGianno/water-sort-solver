import assert from "node:assert/strict";
import test from "node:test";

import { CAP, SAMPLE_PUZZLE } from "../assets/js/constants.ts";
import { aStarSolve } from "../assets/js/solver-core.js";
import { createSolver } from "../assets/js/solver.js";

class FakeWorker {
  constructor(autoSolve = true) {
    this.autoSolve = autoSolve;
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    this.messages.push(message);
    if (!this.autoSolve) return;
    queueMicrotask(() => {
      const result = aStarSolve(message.bottles, message.mode, {
        cap: message.cap,
      });
      this.emit({ type: "result", requestId: message.requestId, result });
    });
  }

  emit(data) {
    this.onmessage?.({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

function createFixture(bottles, options = {}) {
  const elements = {
    modeSel: { value: options.mode || "fast" },
    shortMoves: { checked: false },
    showStates: { checked: false },
    output: { textContent: "Previous solution" },
    status: { textContent: "Done." },
    solveBtn: {
      textContent: "Solve puzzle",
      disabled: false,
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    },
  };
  const state = {
    bottleLayers: bottles.map((bottle) => bottle.slice()),
    selectedLayer: 1,
    openPopoverBottle: 2,
    isSolving: false,
  };
  const messages = {
    errors: [],
    successes: [],
    replay: options.previousReplay ?? null,
  };
  const worker = new FakeWorker(options.autoSolve !== false);
  const solver = createSolver({
    CAP,
    state,
    el: (id) => elements[id],
    showError: (message) => messages.errors.push(message),
    showSuccess: (message) => messages.successes.push(message),
    readStateFromInput: () => bottles.map((bottle) => bottle.slice()),
    validateInput: () => options.validationError || null,
    closeAllPopovers: () => {},
    renderAllLayers: () => {},
    showReplay: (replay) => {
      messages.replay = replay;
    },
    updateSolveEnabled: () => {
      elements.solveBtn.disabled = Boolean(options.validationError);
    },
    createWorker: () => worker,
  });

  return { elements, messages, solver, state, worker };
}

function isSolved(bottles) {
  return bottles.every(
    (bottle) =>
      bottle.length === 0 ||
      (bottle.length === CAP && bottle.every((color) => color === bottle[0])),
  );
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("the solver core preserves valid results in both search modes", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];

  for (const mode of ["fast", "optimal"]) {
    const result = aStarSolve(bottles, mode, { cap: CAP });
    assert.equal(result.ok, true);
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
    assert.equal(isSolved(current), true);
  }
});

test("the curated sample demonstrates the fast versus optimal-ish tradeoff", () => {
  const bottles = SAMPLE_PUZZLE.layers.map((layers) =>
    layers.filter(Boolean).reverse(),
  );
  const fast = aStarSolve(bottles, "fast", { cap: CAP });
  const optimal = aStarSolve(bottles, "optimal", { cap: CAP });

  assert.equal(fast.ok, true);
  assert.equal(optimal.ok, true);
  assert.ok(fast.moves.length > optimal.moves.length);
  assert.ok(optimal.explored > fast.explored * 5);
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

  assert.equal(elements.output.textContent, "Already solved.");
  assert.equal(elements.status.textContent, "Done.");
  assert.deepEqual(messages.replay.moves, []);
  assert.deepEqual(messages.replay.states, [bottles]);
  assert.match(messages.successes.at(-1), /^Solved! Moves: 0\./);
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

  assert.ok(messages.replay.moves.length > 0);
  assert.equal(messages.replay.states.length, messages.replay.moves.length + 1);
  assert.deepEqual(messages.replay.states[0], bottles);
  assert.equal(isSolved(messages.replay.states.at(-1)), true);
});

test("solve reports progress and cancellation while ignoring stale results", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];
  const previousReplay = { moves: [{ from: 0, to: 1 }], states: [] };
  const { elements, messages, solver, state, worker } = createFixture(bottles, {
    autoSolve: false,
    previousReplay,
  });

  solver.solve();
  const request = worker.messages[0];
  assert.equal(state.isSolving, true);
  assert.equal(elements.solveBtn.textContent, "Cancel search");
  assert.deepEqual(request, {
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
  assert.match(elements.status.textContent, /expanded 5[.,]000 states/);

  solver.cancelSolve();
  assert.equal(worker.terminated, true);
  assert.equal(state.isSolving, false);
  assert.equal(elements.solveBtn.textContent, "Solve puzzle");
  assert.equal(elements.status.textContent, "Search cancelled.");

  worker.emit({
    type: "result",
    requestId: request.requestId,
    result: { ok: true, moves: [], explored: 1 },
  });
  assert.equal(messages.replay, previousReplay);
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

  assert.equal(state.isSolving, false);
  assert.equal(elements.solveBtn.textContent, "Solve puzzle");
  assert.equal(elements.status.textContent, "Search failed.");
  assert.equal(messages.replay, previousReplay);
  assert.equal(messages.errors.at(-1), "Solver error: Worker crashed.");
});

test("solve surfaces validation errors without starting a worker", () => {
  const bottles = [[], [], [], []];
  const { messages, solver, worker } = createFixture(bottles, {
    validationError: "Select colors first.",
  });

  solver.solve();

  assert.equal(messages.errors.at(-1), "Select colors first.");
  assert.equal(worker.messages.length, 0);
});
