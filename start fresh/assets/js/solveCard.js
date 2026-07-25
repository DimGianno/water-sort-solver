// solveCard.js
import { colorHex, colorName } from "./palette.js";
import { solveAStar, applyMove, CAP } from "./solverCore.js";

function draftToSolverState(draft) {
  // build draft is top->bottom with "" for empty
  // solver wants bottom->top with no empties
  return draft.map(bottle =>
    bottle
      .slice()
      .reverse()       // bottom->top
      .filter(v => v !== "")
  );
}

function cloneState(st) {
  return st.map(b => b.slice());
}

function formatState(st) {
  return st
    .map((b, i) => `${i + 1}: [${b.length ? b.join(", ") : "empty"}]`)
    .join("\n");
}

export function initSolveCard(options = {}) {
  const { onBack } = options;

  const summaryEl = document.getElementById("solveSummary");
  const modeSel = document.getElementById("solveModeSel");
  const showStatesEl = document.getElementById("solveShowStates");
  const shortMovesEl = document.getElementById("solveShortMoves");
  const runBtn = document.getElementById("solveRunBtn");
  const backBtn = document.getElementById("solveBackBtn");
  const statusEl = document.getElementById("solveStatus");
  const errEl = document.getElementById("solveError");
  const okEl = document.getElementById("solveSuccess");
  const outEl = document.getElementById("solveOutput");

  const replayGrid = document.getElementById("replayGrid");
  const replayHint = document.getElementById("replayHint");
  const prevBtn = document.getElementById("replayPrevBtn");
  const nextBtn = document.getElementById("replayNextBtn");
  const playBtn = document.getElementById("replayPlayBtn");
  const pauseBtn = document.getElementById("replayPauseBtn");
  const speedRange = document.getElementById("replaySpeed");
  const speedLabel = document.getElementById("replaySpeedLabel");
  const stepLabel = document.getElementById("replayStepLabel");

  if (!summaryEl || !modeSel || !runBtn || !backBtn || !statusEl || !errEl || !okEl || !outEl ||
      !replayGrid || !replayHint || !prevBtn || !nextBtn || !playBtn || !pauseBtn || !speedRange || !speedLabel || !stepLabel) {
    console.warn("SolveCard: missing HTML elements");
    return { configure: () => {} };
  }

  let startState = null;
  let solution = null; // { moves, states }
  let replayIndex = 0;
  let timer = null;

  function setError(msg) {
    errEl.textContent = msg || "";
    okEl.textContent = "";
  }

  function setSuccess(msg) {
    okEl.textContent = msg || "";
    errEl.textContent = "";
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function renderReplay() {
    if (!solution) return;

    const states = solution.states;
    const moves = solution.moves;
    const stepMax = states.length - 1;

    stepLabel.textContent = `Step ${replayIndex}/${stepMax}`;
    speedLabel.textContent = `${speedRange.value}×`;

    let hlFrom = -1, hlTo = -1;
    if (replayIndex > 0 && moves[replayIndex - 1]) {
      hlFrom = moves[replayIndex - 1].from;
      hlTo = moves[replayIndex - 1].to;
    }

    replayGrid.innerHTML = "";

    const row1 = document.createElement("div");
    row1.className = "replayRow";
    const row2 = document.createElement("div");
    row2.className = "replayRow";
    replayGrid.appendChild(row1);
    replayGrid.appendChild(row2);

    const st = states[replayIndex];
    const split = Math.ceil(st.length / 2);

    for (let i = 0; i < st.length; i++) {
      const rb = document.createElement("div");
      rb.className = "rbottle" + ((i === hlFrom || i === hlTo) ? " hl" : "");

      const title = document.createElement("div");
      title.className = "rtitle";
      const left = document.createElement("span");
      left.textContent = `${i + 1}`;
      const right = document.createElement("span");
      right.className = "rtofrom";
      right.textContent = (i === hlFrom) ? "FROM" : (i === hlTo) ? "TO" : "";
      title.appendChild(left);
      title.appendChild(right);

      const stack = document.createElement("div");
      stack.className = "rstack";

      // state is bottom->top, but we want draw top->bottom
      const topToBottom = st[i].slice().reverse();
      const padded = Array(CAP - topToBottom.length).fill("").concat(topToBottom);

      for (let l = 0; l < CAP; l++) {
        const seg = document.createElement("div");
        seg.className = "rseg";
        const c = padded[l];
        seg.style.background = c ? colorHex(c) : "transparent";
        stack.appendChild(seg);
      }

      rb.appendChild(title);
      rb.appendChild(stack);

      (i < split ? row1 : row2).appendChild(rb);
    }

    prevBtn.disabled = replayIndex === 0;
    nextBtn.disabled = replayIndex === stepMax;
  }

  function showReplay(sol) {
    solution = sol;
    replayIndex = 0;
    replayHint.hidden = true;
    renderReplay();
  }

  function hideReplay() {
    stopTimer();
    solution = null;
    replayIndex = 0;
    replayGrid.innerHTML = "";
    replayHint.hidden = false;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pauseBtn.disabled = true;
    playBtn.disabled = false;
    stepLabel.textContent = "Step 0/0";
  }

  function stepPrev() {
    if (!solution) return;
    replayIndex = Math.max(0, replayIndex - 1);
    renderReplay();
  }

  function stepNext() {
    if (!solution) return;
    replayIndex = Math.min(solution.states.length - 1, replayIndex + 1);
    renderReplay();
  }

  function play() {
    if (!solution || timer) return;
    playBtn.disabled = true;
    pauseBtn.disabled = false;

    const speed = parseFloat(speedRange.value);
    const interval = Math.max(80, Math.floor(600 / speed));

    timer = setInterval(() => {
      if (!solution) return;
      if (replayIndex >= solution.states.length - 1) {
        pause();
        return;
      }
      replayIndex++;
      renderReplay();
    }, interval);
  }

  function pause() {
    stopTimer();
    playBtn.disabled = false;
    pauseBtn.disabled = true;
  }

  prevBtn.addEventListener("click", stepPrev);
  nextBtn.addEventListener("click", stepNext);
  playBtn.addEventListener("click", play);
  pauseBtn.addEventListener("click", pause);

  speedRange.addEventListener("input", () => {
    speedLabel.textContent = `${speedRange.value}×`;
    if (timer) {
      pause();
      play();
    }
  });

  backBtn.addEventListener("click", () => {
    pause();
    if (typeof onBack === "function") onBack();
  });

  runBtn.addEventListener("click", () => {
    setError("");
    setSuccess("");
    hideReplay();

    if (!startState) {
      setError("No puzzle loaded.");
      return;
    }

    statusEl.textContent = "Solving…";
    outEl.textContent = "Solving…";

    const mode = modeSel.value === "optimal" ? "optimal" : "fast";
    const shortMoves = !!shortMovesEl.checked;
    const showStates = !!showStatesEl.checked;

    const t0 = performance.now();
    const res = solveAStar(startState, mode);
    const t1 = performance.now();

    if (!res.ok) {
      setError(`Failed: ${res.reason}`);
      statusEl.textContent = "Failed.";
      outEl.textContent = `Failed: ${res.reason}\nExpanded: ${res.explored.toLocaleString()} states\nTime: ${(t1 - t0).toFixed(0)} ms`;
      return;
    }

    setSuccess(
      `Solved! Moves: ${res.moves.length}.\n` + 
      `Expanded: ${res.explored.toLocaleString()} states. Time: ${(t1 - t0).toFixed(0)} ms`
    );
    statusEl.textContent = "Done.";

    // build state list for replay
    const states = [cloneState(startState)];
    let cur = cloneState(startState);
    for (const mv of res.moves) {
      cur = applyMove(cur, mv);
      states.push(cloneState(cur));
    }

    // output text
    let text = "";
    for (let i = 0; i < res.moves.length; i++) {
      const m = res.moves[i];
      const line = shortMoves
        ? `${i + 1}. ${m.from + 1} → ${m.to + 1}`
        : `${i + 1}. ${m.from + 1} → ${m.to + 1} (${m.amt} ${colorName(m.color)})`;
      text += line + "\n";
      if (showStates) text += formatState(states[i + 1]) + "\n\n";
    }
    if (!text) text = "Already solved.";
    outEl.textContent = text.trimEnd();

    showReplay({ moves: res.moves, states });
  });

  function configure({ bottleCount, selectedColors, draft }) {
    // draft is required here (Step 3 already validates)
    startState = draftToSolverState(draft);

    summaryEl.textContent =
      `Ready to solve.`;

    statusEl.textContent = "";
    setError("");
    setSuccess("");
    outEl.textContent = "Press Solve.";
    hideReplay();
  }

  return { configure };
}
