import { describe, expect, test } from "vitest";

import { CAP, DEFAULT_COLORS } from "../assets/js/constants.ts";
import { createValidation } from "../assets/js/validation.ts";

interface FixtureOptions {
  checkedColors?: string[];
  layers?: string[][];
  isSolving?: boolean;
}

interface CancellationOptions {
  reason?: string;
}

function createFixture({
  checkedColors = ["Red", "Blue"],
  layers = [],
  isSolving = false,
}: FixtureOptions = {}) {
  const checkboxes = DEFAULT_COLORS.map((value) => ({
    value,
    checked: checkedColors.includes(value),
  }));
  const elements = {
    colorChecklist: {
      querySelectorAll(selector: string) {
        expect(selector).toBe('input[type="checkbox"]:checked');
        return checkboxes.filter((checkbox) => checkbox.checked);
      },
    },
    numBottles: { value: String(layers.length || 4) },
    solveBtn: { disabled: false },
    validationMsg: { textContent: "", style: { color: "" } },
  };
  const state = {
    bottleLayers: layers.map((bottle) => bottle.slice()),
    isSolving,
  };
  const cancellations: CancellationOptions[] = [];
  const context = {
    CAP,
    DEFAULT_COLORS,
    state,
    el: (id: string) => elements[id as keyof typeof elements],
    cancelSolve: (options: CancellationOptions) => {
      cancellations.push(options);
      state.isSolving = false;
    },
  };

  return {
    state,
    elements,
    cancellations,
    validation: createValidation(
      context as unknown as Parameters<typeof createValidation>[0],
    ),
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

  expect(validation.readStateFromInput()).toEqual([
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

  expect(cancellations).toEqual([
    { reason: "Puzzle changed. Search cancelled." },
  ]);
  expect(elements.solveBtn.disabled).toBe(false);
});

test("validateInput accepts a complete puzzle with two empty helper bottles", () => {
  const { validation } = createFixture();
  const bottles = [
    ["Red", "Red", "Blue", "Blue"],
    ["Blue", "Blue", "Red", "Red"],
    [],
    [],
  ];

  expect(validation.validateInput(bottles)).toBeNull();
});

describe("validateInput reports structural and color-count errors", () => {
  const { validation } = createFixture();

  test("requires selected colors", () => {
    expect(validation.validateInput([[], [], [], []], [])).toBe(
      "Select colors first.",
    );
  });

  test("requires at least four bottles", () => {
    expect(validation.validateInput([[], [], []], ["Red"])).toBe(
      "Invalid bottle count (min 4).",
    );
  });

  test("requires both helper bottles to be empty", () => {
    const bottles = [
      ["Red", "Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Blue"],
      ["Red"],
      [],
    ];
    expect(validation.validateInput(bottles)).toBe(
      "Last 2 bottles must be empty (helpers).",
    );
  });

  test("requires every playable bottle to be full", () => {
    const bottles = [
      ["Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Blue"],
      [],
      [],
    ];
    expect(validation.validateInput(bottles)).toBe(
      `Bottle 1 must have exactly ${CAP} layers (fill all).`,
    );
  });

  test("rejects colors that were not selected", () => {
    const bottles = [
      ["Red", "Red", "Red", "Green"],
      ["Blue", "Blue", "Blue", "Blue"],
      [],
      [],
    ];
    expect(validation.validateInput(bottles)).toBe(
      'Color "Green" is used but not selected in the checklist.',
    );
  });

  test("requires exactly four pieces of each selected color", () => {
    const bottles = [
      ["Red", "Red", "Red", "Red"],
      ["Blue", "Blue", "Blue", "Red"],
      [],
      [],
    ];
    expect(validation.validateInput(bottles)).toBe(
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
  expect(elements.validationMsg.textContent).toBe(
    "Input looks valid. You can solve.",
  );
  expect(elements.validationMsg.style.color).toBe("#0a7a22");
  expect(elements.solveBtn.disabled).toBe(false);

  state.bottleLayers[0][0] = "";
  validation.runContinuousValidation();
  validation.updateSolveEnabled();
  expect(elements.validationMsg.textContent).toMatch(/^Invalid: Bottle 1/);
  expect(elements.validationMsg.style.color).toBe("#b00020");
  expect(elements.solveBtn.disabled).toBe(true);
});
