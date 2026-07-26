import assert from "node:assert/strict";
import test from "node:test";

import { CAP, DEFAULT_COLORS } from "../assets/js/constants.js";
import { createValidation } from "../assets/js/validation.js";

function createFixture({
  checkedColors = ["Red", "Blue"],
  layers = [],
  isSolving = false,
} = {}) {
  const checkboxes = DEFAULT_COLORS.map((value) => ({
    value,
    checked: checkedColors.includes(value),
  }));
  const elements = {
    colorChecklist: {
      querySelectorAll(selector) {
        assert.equal(selector, 'input[type="checkbox"]:checked');
        return checkboxes.filter((checkbox) => checkbox.checked);
      },
    },
    numBottles: { value: String(layers.length || 4) },
    solveBtn: { disabled: false },
    validationMsg: { textContent: "", style: {} },
  };
  const state = {
    bottleLayers: layers.map((bottle) => bottle.slice()),
    isSolving,
  };
  const cancellations = [];
  const context = {
    CAP,
    DEFAULT_COLORS,
    state,
    el: (id) => elements[id],
    cancelSolve: (options) => {
      cancellations.push(options);
      state.isSolving = false;
    },
  };

  return {
    state,
    elements,
    cancellations,
    validation: createValidation(context),
  };
}

test("readStateFromInput removes blanks and converts top-first layers to bottom-first bottles", () => {
  const { validation } = createFixture({
    layers: [
      ["Blue", "", "Red", "Red"],
      ["Red", "Blue", "Blue", "Red"],
      ["", "", "", ""],
      ["", "", "", ""],
    ],
  });

  assert.deepEqual(validation.readStateFromInput(), [
    ["Red", "Red", "Blue"],
    ["Red", "Blue", "Blue", "Red"],
    [],
    [],
  ]);
});

test("changing puzzle validity cancels an active search before updating the solve button", () => {
  const layers = [
    ["Blue", "Blue", "Red", "Red"],
    ["Red", "Red", "Blue", "Blue"],
    ["", "", "", ""],
    ["", "", "", ""],
  ];
  const { cancellations, elements, validation } = createFixture({
    layers,
    isSolving: true,
  });

  validation.updateSolveEnabled();

  assert.deepEqual(cancellations, [
    { reason: "Puzzle changed. Search cancelled." },
  ]);
  assert.equal(elements.solveBtn.disabled, false);
});

test("validateInput accepts a complete puzzle with two empty helper bottles", () => {
  const { validation } = createFixture();
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];

  assert.equal(validation.validateInput(bottles), null);
});

test("validateInput reports structural and color-count errors", async (t) => {
  const { validation } = createFixture();

  await t.test("requires selected colors", () => {
    assert.equal(
      validation.validateInput([[], [], [], []], []),
      "Select colors first.",
    );
  });

  await t.test("requires at least four bottles", () => {
    assert.equal(
      validation.validateInput([[], [], []], ["Red"]),
      "Invalid bottle count (min 4).",
    );
  });

  await t.test("requires both helper bottles to be empty", () => {
    const bottles = [
      ["Red", "Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Blue"],
      ["Red"],
      [],
    ];
    assert.equal(
      validation.validateInput(bottles),
      "Last 2 bottles must be empty (helpers).",
    );
  });

  await t.test("requires every playable bottle to be full", () => {
    const bottles = [
      ["Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Blue"],
      [],
      [],
    ];
    assert.equal(
      validation.validateInput(bottles),
      `Bottle 1 must have exactly ${CAP} layers (fill all).`,
    );
  });

  await t.test("rejects colors that were not selected", () => {
    const bottles = [
      ["Red", "Red", "Red", "Green"],
      ["Blue", "Blue", "Blue", "Blue"],
      [],
      [],
    ];
    assert.equal(
      validation.validateInput(bottles),
      'Color "Green" is used but not selected in the checklist.',
    );
  });

  await t.test("requires exactly four pieces of each selected color", () => {
    const bottles = [
      ["Red", "Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Red"],
      [],
      [],
    ];
    assert.equal(
      validation.validateInput(bottles),
      'Color "Red" appears 5 times, but must appear exactly 4 times.',
    );
  });
});

test("continuous validation keeps the message and solve button in sync", () => {
  const layers = [
    ["Blue", "Blue", "Red", "Red"],
    ["Red", "Red", "Blue", "Blue"],
    ["", "", "", ""],
    ["", "", "", ""],
  ];
  const { state, elements, validation } = createFixture({ layers });

  validation.runContinuousValidation();
  validation.updateSolveEnabled();
  assert.equal(
    elements.validationMsg.textContent,
    "Input looks valid. You can solve.",
  );
  assert.equal(elements.validationMsg.style.color, "#0a7a22");
  assert.equal(elements.solveBtn.disabled, false);

  state.bottleLayers[0][0] = "";
  validation.runContinuousValidation();
  validation.updateSolveEnabled();
  assert.match(elements.validationMsg.textContent, /^Invalid: Bottle 1/);
  assert.equal(elements.validationMsg.style.color, "#b00020");
  assert.equal(elements.solveBtn.disabled, true);
});
