import { applyMove, cloneState } from "./solver-core.ts";
import type {
  PuzzleState,
  ReplaySolution,
  SolveWorkerRequest,
  SolverMode,
  SolverResult,
  SolverWorkerMessage,
} from "./solver-types.ts";

interface SolverState {
  bottleLayers: string[][];
  selectedLayer: unknown;
  openPopoverBottle: number | null;
  isSolving: boolean;
  revealReplayOnSolve: boolean;
}

interface SolverContext {
  CAP: number;
  state: SolverState;
  el: <T extends HTMLElement = HTMLElement>(id: string) => T;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  readStateFromInput: () => PuzzleState;
  validateCurrentInput: () => string | null;
  closeAllPopovers: () => void;
  renderAllLayers: () => void;
  showReplay: (solution: ReplaySolution) => void;
  updateSolveEnabled: () => void;
  createWorker?: () => Worker;
}

interface CancelSolveOptions {
  silent?: boolean;
  reason?: string;
}

interface DisplayOptions {
  shortMoves: boolean;
  showStates: boolean;
}

interface SolverController {
  solve: () => void;
  cancelSolve: (options?: CancelSolveOptions) => boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error.";
}

export function createSolver(ctx: SolverContext): SolverController {
  const { CAP, state, el } = ctx;
  const {
    showError,
    showSuccess,
    readStateFromInput,
    validateCurrentInput,
    closeAllPopovers,
    renderAllLayers,
    showReplay,
    updateSolveEnabled,
  } = ctx;
  const makeWorker: () => Worker =
    ctx.createWorker ??
    (() =>
      new Worker(new URL("./solver-worker.ts", import.meta.url), {
        type: "module",
      }));

  let activeWorker: Worker | null = null;
  let activeRequestId = 0;

  function formatState(bottles: PuzzleState): string {
    return bottles
      .map(
        (bottle, index) =>
          `${index + 1}: [${bottle.length ? bottle.join(", ") : "empty"}]`,
      )
      .join("\n");
  }

  function setSolveControl(isSolving: boolean): void {
    state.isSolving = isSolving;
    const button = el<HTMLButtonElement>("solveBtn");
    button.textContent = isSolving ? "Cancel search" : "Solve puzzle";
    button.setAttribute("aria-label", button.textContent);
    if (isSolving) button.disabled = false;
    else updateSolveEnabled();
  }

  function releaseWorker(): void {
    if (activeWorker) activeWorker.terminate();
    activeWorker = null;
  }

  function cancelSolve(options: CancelSolveOptions = {}): boolean {
    if (!activeWorker) return false;
    const requestId = activeRequestId;
    activeRequestId++;
    releaseWorker();
    setSolveControl(false);
    state.revealReplayOnSolve = false;

    if (!options.silent) {
      showError("");
      showSuccess("");
      const message = options.reason || "Search cancelled.";
      el("status").textContent = message;
      el("output").textContent = message;
    }
    return requestId > 0;
  }

  function finishRequest(requestId: number): boolean {
    if (!activeWorker || requestId !== activeRequestId) return false;
    releaseWorker();
    setSolveControl(false);
    return true;
  }

  function showWorkerFailure(requestId: number, message?: string): void {
    if (!finishRequest(requestId)) return;
    const detail = message || "Unknown worker error.";
    state.revealReplayOnSolve = false;
    showError(`Solver error: ${detail}`);
    el("status").textContent = "Search failed.";
    el("output").textContent = `Solver error: ${detail}`;
  }

  function renderSolution(
    bottles: PuzzleState,
    result: SolverResult,
    options: DisplayOptions,
    elapsed: number,
  ): void {
    if (!result.ok) {
      state.revealReplayOnSolve = false;
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

    const states: PuzzleState[] = [cloneState(bottles)];
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
    if (state.revealReplayOnSolve) {
      state.revealReplayOnSolve = false;
      const reduceMotion = globalThis.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el("replayCard").scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }

  function solve(): void {
    if (activeWorker) {
      cancelSolve();
      return;
    }

    showError("");
    showSuccess("");
    if (!state.bottleLayers.length) return;

    const bottles = readStateFromInput();
    const validationError = validateCurrentInput();
    if (validationError) {
      showError(validationError);
      return;
    }

    const mode: SolverMode =
      el<HTMLSelectElement>("modeSel").value === "optimal" ? "optimal" : "fast";
    const displayOptions: DisplayOptions = {
      shortMoves: el<HTMLInputElement>("shortMoves").checked,
      showStates: el<HTMLInputElement>("showStates").checked,
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
      activeWorker.onmessage = (event: MessageEvent<SolverWorkerMessage>) => {
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
      activeWorker.onerror = (event: ErrorEvent) => {
        event.preventDefault();
        showWorkerFailure(requestId, event.message);
      };
      const request: SolveWorkerRequest = {
        type: "solve",
        requestId,
        bottles,
        mode,
        cap: CAP,
      };
      activeWorker.postMessage(request);
    } catch (error) {
      releaseWorker();
      setSolveControl(false);
      showError(`Solver error: ${getErrorMessage(error)}`);
      el("status").textContent = "Search failed.";
    }
  }

  return { solve, cancelSolve };
}
