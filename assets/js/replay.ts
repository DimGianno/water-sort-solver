import type { AppState, ElementLookup } from "./app-types.ts";
import type { ReplaySolution } from "./solver-types.ts";

interface ReplayContext {
  CAP: number;
  COLOR_PALETTE: Readonly<Record<string, string>>;
  state: AppState;
  el: ElementLookup;
}

export function createReplay(ctx: ReplayContext) {
  const { CAP, COLOR_PALETTE, state, el } = ctx;

  function hideReplay(): void {
    el("replay").style.display = "none";
    el("replayPlaceholder").style.display = "flex";
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
    state.replayIndex = 0;
  }

  function showReplay(solution: ReplaySolution): void {
    state.lastSolution = solution;
    state.replayIndex = 0;
    el("replay").style.display = "block";
    el("replayPlaceholder").style.display = "none";
    el<HTMLButtonElement>("pauseBtn").disabled = true;
    el<HTMLButtonElement>("playBtn").disabled = false;
    renderReplay();
  }

  function renderReplay(): void {
    if (!state.lastSolution) return;

    const states = state.lastSolution.states;
    const moves = state.lastSolution.moves;

    const stepMax = states.length - 1;
    el("stepLabel").textContent = `Step ${state.replayIndex}/${stepMax}`;

    const speed = parseFloat(el<HTMLInputElement>("speedRange").value);
    el("speedLabel").textContent = `${speed}x`;

    let hlFrom = -1;
    let hlTo = -1;
    if (state.replayIndex > 0 && moves[state.replayIndex - 1]) {
      hlFrom = moves[state.replayIndex - 1].from;
      hlTo = moves[state.replayIndex - 1].to;
    }

    const grid = el("replayGrid");
    grid.innerHTML = "";

    grid.classList.add("board");

    // Fixed 2-row layout (match the builder board): if odd, row 1 gets the extra.
    const row1 = document.createElement("div");
    row1.className = "board-row";
    const row2 = document.createElement("div");
    row2.className = "board-row";
    grid.appendChild(row1);
    grid.appendChild(row2);

    const st = states[state.replayIndex];
    const split = Math.ceil(st.length / 2);

    for (let i = 0; i < st.length; i++) {
      const rb = document.createElement("div");
      rb.className = "rbottle" + (i === hlFrom || i === hlTo ? " hl" : "");
      const t = document.createElement("div");
      t.className = "bottle-title";
      t.innerHTML = `<span>${i + 1}</span><span class="replay-move">${i === hlFrom ? "from" : i === hlTo ? "to" : ""}</span>`;
      rb.appendChild(t);

      const stack = document.createElement("div");
      stack.className = "rstack";

      const topToBottom = st[i].slice().reverse();
      const padded = Array(CAP - topToBottom.length)
        .fill("")
        .concat(topToBottom);

      for (let l = 0; l < CAP; l++) {
        const seg = document.createElement("div");
        seg.className = "rseg";
        const c = padded[l];
        if (c) seg.style.background = COLOR_PALETTE[c] || "#ddd";
        else {
          seg.classList.add("empty");
          seg.style.background = "";
        }
        stack.appendChild(seg);
      }

      rb.appendChild(stack);

      const targetRow = i < split ? row1 : row2;
      targetRow.appendChild(rb);
    }

    el<HTMLButtonElement>("prevStepBtn").disabled = state.replayIndex === 0;
    el<HTMLButtonElement>("nextStepBtn").disabled =
      state.replayIndex === stepMax;
  }

  function stepPrev(): void {
    if (!state.lastSolution) return;
    state.replayIndex = Math.max(0, state.replayIndex - 1);
    renderReplay();
  }

  function stepNext(): void {
    if (!state.lastSolution) return;
    state.replayIndex = Math.min(
      state.lastSolution.states.length - 1,
      state.replayIndex + 1,
    );
    renderReplay();
  }

  function playReplay(): void {
    if (!state.lastSolution) return;
    if (state.replayTimer) return;
    const solution = state.lastSolution;

    el<HTMLButtonElement>("playBtn").disabled = true;
    el<HTMLButtonElement>("pauseBtn").disabled = false;

    const speed = parseFloat(el<HTMLInputElement>("speedRange").value);
    const interval = Math.max(80, Math.floor(600 / speed));

    state.replayTimer = setInterval(() => {
      if (state.replayIndex >= solution.states.length - 1) {
        pauseReplay();
        return;
      }
      state.replayIndex++;
      renderReplay();
    }, interval);
  }

  function pauseReplay(): void {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
    el<HTMLButtonElement>("playBtn").disabled = false;
    el<HTMLButtonElement>("pauseBtn").disabled = true;
  }

  function onSpeedChange(): void {
    el("speedLabel").textContent =
      `${el<HTMLInputElement>("speedRange").value}x`;
    if (state.replayTimer) {
      pauseReplay();
      playReplay();
    }
  }

  return {
    hideReplay,
    showReplay,
    renderReplay,
    stepPrev,
    stepNext,
    playReplay,
    pauseReplay,
    onSpeedChange,
  };
}
