export function createValidation(ctx) {
  const { CAP, DEFAULT_COLORS, state, el } = ctx;

  function selectedColors() {
    return Array.from(
      el("colorChecklist").querySelectorAll('input[type="checkbox"]:checked'),
    ).map((x) => x.value);
  }

  function colorMaxAllowed() {
    const n = parseInt(el("numBottles").value, 10);
    return Math.max(1, Math.min(12, n - 2));
  }

  function computeUsedCounts() {
    const counts = {};
    for (const c of DEFAULT_COLORS) counts[c] = 0;
    for (let b = 0; b < state.bottleLayers.length; b++) {
      if (b >= state.bottleLayers.length - 2) continue;
      for (let l = 0; l < CAP; l++) {
        const v = state.bottleLayers[b][l];
        if (v) counts[v] = (counts[v] || 0) + 1;
      }
    }
    return counts;
  }

  function readStateFromInput() {
    const n = state.bottleLayers.length;
    const bottles = [];
    for (let b = 0; b < n; b++) {
      const topToBottom = state.bottleLayers[b].slice();
      const filtered = topToBottom.filter((v) => v !== "");
      const bottomToTop = filtered.slice().reverse();
      bottles.push(bottomToTop);
    }
    return bottles;
  }

  function validateInput(bottles, colors = selectedColors()) {
    const n = bottles.length;
    if (!colors.length) return "Select colors first.";
    if (n < 4) return "Invalid bottle count (min 4).";
    if (bottles[n - 1].length !== 0 || bottles[n - 2].length !== 0)
      return "Last 2 bottles must be empty (helpers).";

    for (let i = 0; i < n - 2; i++) {
      if (bottles[i].length !== CAP)
        return `Bottle ${i + 1} must have exactly ${CAP} layers (fill all).`;
    }

    const counts = new Map();
    for (const c of colors) counts.set(c, 0);
    for (const b of bottles) {
      for (const c of b) {
        if (!counts.has(c))
          return `Color "${c}" is used but not selected in the checklist.`;
        counts.set(c, counts.get(c) + 1);
      }
    }
    for (const c of colors) {
      const k = counts.get(c) || 0;
      if (k !== CAP)
        return `Color "${c}" appears ${k} times, but must appear exactly ${CAP} times.`;
    }
    return null;
  }

  function runContinuousValidation() {
    if (!state.bottleLayers.length) {
      el("validationMsg").textContent = "";
      return;
    }
    const err = validateInput(readStateFromInput());
    if (err) {
      el("validationMsg").textContent = "Invalid: " + err;
      el("validationMsg").style.color = "#b00020";
    } else {
      el("validationMsg").textContent = "Input looks valid. You can solve.";
      el("validationMsg").style.color = "#0a7a22";
    }
  }

  function updateSolveEnabled() {
    if (state.isSolving) {
      ctx.cancelSolve?.({ reason: "Puzzle changed. Search cancelled." });
    }
    if (!state.bottleLayers.length) {
      el("solveBtn").disabled = true;
      return;
    }
    const err = validateInput(readStateFromInput());
    el("solveBtn").disabled = !!err;
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
