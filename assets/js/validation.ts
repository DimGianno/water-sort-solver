import type { PuzzleState } from "./solver-types.ts";

interface ValidationState {
  bottleLayers: string[][];
  isSolving: boolean;
}

interface CancelOptions {
  reason?: string;
}

interface ValidationContext {
  CAP: number;
  DEFAULT_COLORS: readonly string[];
  state: ValidationState;
  el: <T extends HTMLElement = HTMLElement>(id: string) => T;
  cancelSolve?: (options: CancelOptions) => void;
}

export function createValidation(ctx: ValidationContext) {
  const { CAP, DEFAULT_COLORS, state, el } = ctx;

  function selectedColors(): string[] {
    return Array.from(
      el("colorChecklist").querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:checked',
      ),
    ).map((input) => input.value);
  }

  function colorMaxAllowed(): number {
    const n = parseInt(el<HTMLInputElement>("numBottles").value, 10);
    return Math.max(1, Math.min(12, n - 2));
  }

  function computeUsedCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const color of DEFAULT_COLORS) counts[color] = 0;
    for (let bottle = 0; bottle < state.bottleLayers.length; bottle++) {
      if (bottle >= state.bottleLayers.length - 2) continue;
      for (let layer = 0; layer < CAP; layer++) {
        const color = state.bottleLayers[bottle][layer];
        if (color) counts[color] = (counts[color] || 0) + 1;
      }
    }
    return counts;
  }

  function readStateFromInput(): PuzzleState {
    return state.bottleLayers.map((layers) =>
      layers.filter((color) => color !== "").reverse(),
    );
  }

  function validateInput(
    bottles: PuzzleState,
    colors: string[] = selectedColors(),
  ): string | null {
    const n = bottles.length;
    if (!colors.length) return "Select colors first.";
    if (n < 4) return "Invalid bottle count (min 4).";
    if (bottles[n - 1].length !== 0 || bottles[n - 2].length !== 0)
      return "Last 2 bottles must be empty (helpers).";

    for (let i = 0; i < n - 2; i++) {
      if (bottles[i].length !== CAP)
        return `Bottle ${i + 1} must have exactly ${CAP} layers (fill all).`;
    }

    const counts = new Map<string, number>();
    for (const color of colors) counts.set(color, 0);
    for (const bottle of bottles) {
      for (const color of bottle) {
        if (!counts.has(color))
          return `Color "${color}" is used but not selected in the checklist.`;
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    }
    for (const color of colors) {
      const count = counts.get(color) ?? 0;
      if (count !== CAP)
        return `Color "${color}" appears ${count} times, but must appear exactly ${CAP} times.`;
    }
    return null;
  }

  function runContinuousValidation(): void {
    const message = el<HTMLElement>("validationMsg");
    if (!state.bottleLayers.length) {
      message.textContent = "";
      return;
    }
    const error = validateInput(readStateFromInput());
    if (error) {
      message.textContent = "Invalid: " + error;
      message.style.color = "#b00020";
    } else {
      message.textContent = "Input looks valid. You can solve.";
      message.style.color = "#0a7a22";
    }
  }

  function updateSolveEnabled(): void {
    if (state.isSolving) {
      ctx.cancelSolve?.({ reason: "Puzzle changed. Search cancelled." });
    }
    const solveButton = el<HTMLButtonElement>("solveBtn");
    if (!state.bottleLayers.length) {
      solveButton.disabled = true;
      return;
    }
    solveButton.disabled = Boolean(validateInput(readStateFromInput()));
  }

  return {
    selectedColors,
    colorMaxAllowed,
    computeUsedCounts,
    readStateFromInput,
    validateInput,
    runContinuousValidation,
    updateSolveEnabled,
  };
}
