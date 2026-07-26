import assert from "node:assert/strict";
import test from "node:test";

import { CAP } from "../assets/js/constants.js";
import { createSolver } from "../assets/js/solver.js";

function createFixture(bottles, validationError = null) {
  const elements = {
    modeSel: { value: "fast" },
    shortMoves: { checked: false },
    showStates: { checked: false },
    output: { textContent: "" },
    status: { textContent: "" },
  };
  const state = {
    bottleLayers: bottles.map((bottle) => bottle.slice()),
    selectedLayer: 1,
    openPopoverBottle: 2,
  };
  const messages = { errors: [], successes: [], replay: null };
  const solver = createSolver({
    CAP,
    state,
    el: (id) => elements[id],
    showError: (message) => messages.errors.push(message),
    showSuccess: (message) => messages.successes.push(message),
    readStateFromInput: () => bottles.map((bottle) => bottle.slice()),
    validateInput: () => validationError,
    closeAllPopovers: () => {},
    renderAllLayers: () => {},
    hideReplay: () => {},
    showReplay: (replay) => {
      messages.replay = replay;
    },
  });

  return { elements, messages, solver, state };
}

function isSolved(bottles) {
  return bottles.every(
    (bottle) => bottle.length === 0 || (bottle.length === CAP && bottle.every((color) => color === bottle[0]))
  );
}

test("solve recognizes an already solved puzzle", () => {
  const bottles = [
    ["Red", "Red", "Red", "Red"],
    ["Blue", "Blue", "Blue", "Blue"],
    [],
    [],
  ];
  const { elements, messages, solver } = createFixture(bottles);

  solver.solve();

  assert.equal(elements.output.textContent, "Already solved.");
  assert.equal(elements.status.textContent, "Done.");
  assert.deepEqual(messages.replay.moves, []);
  assert.deepEqual(messages.replay.states, [bottles]);
  assert.match(messages.successes.at(-1), /^Solved! Moves: 0\./);
});

test("solve returns a valid move sequence for a mixed puzzle", () => {
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];
  const { messages, solver } = createFixture(bottles);

  solver.solve();

  assert.ok(messages.replay.moves.length > 0);
  assert.equal(messages.replay.states.length, messages.replay.moves.length + 1);
  assert.deepEqual(messages.replay.states[0], bottles);
  assert.equal(isSolved(messages.replay.states.at(-1)), true);

  messages.replay.moves.forEach((move, index) => {
    const before = messages.replay.states[index];
    const after = messages.replay.states[index + 1];
    assert.ok(move.amt > 0);
    assert.equal(before[move.from].at(-1), move.color);
    assert.equal(after[move.from].length, before[move.from].length - move.amt);
    assert.equal(after[move.to].length, before[move.to].length + move.amt);
    assert.ok(after[move.to].every((color, layer) => layer < before[move.to].length || color === move.color));
  });
});

test("solve surfaces validation errors without starting a search", () => {
  const bottles = [[], [], [], []];
  const { messages, solver } = createFixture(bottles, "Select colors first.");

  solver.solve();

  assert.equal(messages.errors.at(-1), "Select colors first.");
  assert.equal(messages.replay, null);
});
