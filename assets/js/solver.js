import { applyMove, cloneState } from "./solver-core.js";

export function createSolver(ctx) {
  const { CAP, state, el } = ctx;
  const {
    showError,
    showSuccess,
    readStateFromInput,
    validateInput,
    closeAllPopovers,
    renderAllLayers,
    showReplay,
    updateSolveEnabled,
  } = ctx;
  const makeWorker =
    ctx.createWorker ||
    (() =>
      new Worker(new URL("./solver-worker.js", import.meta.url), {
        type: "module",
      }));

  let activeWorker = null;
  let activeRequestId = 0;

  function formatState(bottles) {
    return bottles
      .map(
        (bottle, index) =>
          `${index + 1}: [${bottle.length ? bottle.join(", ") : "empty"}]`,
      )
      .join("\n");
  }

  function setSolveControl(isSolving) {
    state.isSolving = isSolving;
    const button = el("solveBtn");
    button.textContent = isSolving ? "Cancel search" : "Solve puzzle";
    button.setAttribute?.("aria-label", button.textContent);
    if (isSolving) button.disabled = false;
    else updateSolveEnabled();
  }

  function releaseWorker() {
    if (activeWorker) activeWorker.terminate();
    activeWorker = null;
  }

  function cancelSolve(options = {}) {
    if (!activeWorker) return false;
    const requestId = activeRequestId;
    activeRequestId++;
    releaseWorker();
    setSolveControl(false);

    if (!options.silent) {
      showError("");
      showSuccess("");
      const message = options.reason || "Search cancelled.";
      el("status").textContent = message;
      el("output").textContent = message;
    }
    return requestId > 0;
  }

  function finishRequest(requestId) {
    if (!activeWorker || requestId !== activeRequestId) return false;
    releaseWorker();
    setSolveControl(false);
    return true;
  }

  function showWorkerFailure(requestId, message) {
    if (!finishRequest(requestId)) return;
    const detail = message || "Unknown worker error.";
    showError(`Solver error: ${detail}`);
    el("status").textContent = "Search failed.";
    el("output").textContent = `Solver error: ${detail}`;
  }

  function renderSolution(bottles, result, options, elapsed) {
    if (!result.ok) {
      showError(`Failed: ${result.reason}`);
      el("status").textContent = "Search finished without a solution.";
      el("output").textContent =
        `Failed: ${result.reason}\nExpanded: ${result.explored.toLocaleString()} states\nTime: ${elapsed.toFixed(0)} ms`;
      return;
    }

    showSuccess(
      `Solved! Moves: ${result.moves.length}. Expanded: ${result.explored.toLocaleString()} states. Time: ${elapsed.toFixed(0)} ms`,
    );
    el("status").textContent = "Done.";

    const states = [cloneState(bottles)];
    let current = bottles;
    for (const move of result.moves) {
      current = applyMove(current, move, CAP);
      states.push(cloneState(current));
    }

    let text = "";
    result.moves.forEach((move, index) => {
      const moveText = options.shortMoves
        ? `${index + 1}. ${move.from + 1} -> ${move.to + 1}`
        : `${index + 1}. ${move.from + 1} -> ${move.to + 1} (${move.amt} ${move.color})`;
      text += moveText + "\n";
      if (options.showStates) text += formatState(states[index + 1]) + "\n\n";
    });

    el("output").textContent = (text || "Already solved.").trimEnd();
    showReplay({ moves: result.moves, states });
  }

  function solve() {
    if (activeWorker) {
      cancelSolve();
      return;
    }

    showError("");
    showSuccess("");
    if (!state.bottleLayers.length) return;

    const bottles = readStateFromInput();
    const validationError = validateInput(bottles);
    if (validationError) return showError(validationError);

    const mode = el("modeSel").value === "optimal" ? "optimal" : "fast";
    const displayOptions = {
      shortMoves: el("shortMoves").checked,
      showStates: el("showStates").checked,
    };

    state.selectedLayer = null;
    state.openPopoverBottle = null;
    closeAllPopovers();
    renderAllLayers();
    el("output").textContent = `Solving with A* (${mode})...\n`;
    el("status").textContent = "Starting search...";

    const requestId = ++activeRequestId;
    const startedAt = performance.now();
    try {
      activeWorker = makeWorker();
      setSolveControl(true);
      activeWorker.onmessage = (event) => {
        const message = event.data;
        if (!message || message.requestId !== activeRequestId) return;
        if (message.type === "progress") {
          el("status").textContent =
            `Searching (A* ${mode})... expanded ${message.expanded.toLocaleString()} states`;
          return;
        }
        if (message.type === "error") {
          showWorkerFailure(requestId, message.message);
          return;
        }
        if (message.type !== "result" || !finishRequest(requestId)) return;
        renderSolution(
          bottles,
          message.result,
          displayOptions,
          performance.now() - startedAt,
        );
      };
      activeWorker.onerror = (event) => {
        event.preventDefault?.();
        showWorkerFailure(requestId, event.message);
      };
      activeWorker.postMessage({
        type: "solve",
        requestId,
        bottles,
        mode,
        cap: CAP,
      });
    } catch (error) {
      releaseWorker();
      setSolveControl(false);
      showError(`Solver error: ${error?.message || String(error)}`);
      el("status").textContent = "Search failed.";
    }
  }

  return { solve, cancelSolve };
}
