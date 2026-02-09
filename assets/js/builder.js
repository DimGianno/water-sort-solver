export function createBuilder(ctx) {
  const { CAP, COLOR_PALETTE, DEFAULT_COLORS, state, el } = ctx;
  const {
    showError,
    showSuccess,
    selectedColors,
    colorMaxAllowed,
    computeUsedCounts,
    runContinuousValidation,
    updateSolveEnabled,
    hideReplay,
  } = ctx;

  function updateSelectAllVisibility() {
    const n = parseInt(el("numBottles").value, 10);
    el("selectAllBtn").style.display = n === 14 ? "inline-block" : "none";
  }

  function updateColorLimitUI() {
    const max = colorMaxAllowed();
    const chosen = selectedColors().length;
    el("colorLimitHint").textContent = `Selected ${chosen}/${max} colors.`;

    const checkboxes = Array.from(el("colorChecklist").querySelectorAll('input[type="checkbox"]'));
    const lock = chosen >= max;
    for (const cb of checkboxes) cb.disabled = !cb.checked && lock;
  }

  function buildChecklist() {
    const box = el("colorChecklist");
    box.innerHTML = "";
    DEFAULT_COLORS.forEach((c) => {
      const lab = document.createElement("label");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = c;
      cb.addEventListener("change", () => {
        const max = colorMaxAllowed();
        const chosen = selectedColors().length;
        if (chosen > max) cb.checked = false;

        updateColorLimitUI();
        if (state.bottleLayers.length) {
          renderAllLayers();
          renderPopover(state.openPopoverBottle);
          runContinuousValidation();
          updateSolveEnabled();
        }
      });

      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = COLOR_PALETTE[c] || "#ccc";

      const name = document.createElement("span");
      name.textContent = c;

      lab.appendChild(cb);
      lab.appendChild(sw);
      lab.appendChild(name);
      box.appendChild(lab);
    });

    updateSelectAllVisibility();
    updateColorLimitUI();
  }

  function selectAllColors() {
    const n = parseInt(el("numBottles").value, 10);
    if (n !== 14) return;
    el("colorChecklist")
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = true;
      });
    updateColorLimitUI();

    if (state.bottleLayers.length) {
      renderAllLayers();
      renderPopover(state.openPopoverBottle);
      runContinuousValidation();
      updateSolveEnabled();
    }
  }

  function buildBottlesUI() {
    const n = parseInt(el("numBottles").value, 10);
    const colors = selectedColors();

    showError("");
    showSuccess("");
    el("validationMsg").textContent = "";

    if (!Number.isFinite(n) || n < 4) return showError("Number of bottles must be >= 4.");
    if (n > 14) return showError("Max bottles is 14.");

    const maxColors = n - 2;
    if (colors.length === 0) return showError("Select at least 1 color.");
    if (colors.length > maxColors) return showError(`Too many colors selected. Max is ${maxColors}.`);

    state.bottleLayers = Array.from({ length: n }, () => Array.from({ length: CAP }, () => ""));
    state.selectedLayer = null;
    state.inputHistory = [];
    state.openPopoverBottle = null;
    state.lastSolution = null;
    el("undoBtn").disabled = true;
    hideReplay();

    const area = el("bottleArea");
    area.innerHTML = "";

    for (let i = 0; i < n; i++) {
      const isHelperEmpty = i >= n - 2;

      const card = document.createElement("div");
      card.className = "bottle";
      card.dataset.bottle = String(i);

      const title = document.createElement("h3");
      title.innerHTML = `<span>Bottle ${i + 1}</span><span class="small">${isHelperEmpty ? "EMPTY" : ""}</span>`;
      card.appendChild(title);

      const layers = document.createElement("div");
      layers.className = "layers";

      for (let l = 0; l < CAP; l++) {
        const layer = document.createElement("div");
        layer.className = "layer empty";
        layer.dataset.bottle = String(i);
        layer.dataset.layer = String(l);
        layer.innerHTML = `<span class="tag">Tap to set</span><span class="small">${l === 0 ? "TOP" : l === 3 ? "BOTTOM" : ""}</span>`;

        if (isHelperEmpty) {
          layer.style.cursor = "not-allowed";
          layer.style.opacity = "0.55";
          layer.innerHTML = `<span class="tag">Helper</span><span class="small">${l === 0 ? "TOP" : l === 3 ? "BOTTOM" : ""}</span>`;
        } else {
          layer.addEventListener("click", () => onLayerClick(i, l));
        }

        layers.appendChild(layer);
      }

      const pop = document.createElement("div");
      pop.className = "popover";
      pop.id = `popover-${i}`;

      card.appendChild(layers);
      card.appendChild(pop);

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = isHelperEmpty ? "Helper bottle (forced empty)" : "Tap a layer: palette opens in this bottle.";
      card.appendChild(hint);

      area.appendChild(card);
    }

    el("buildMsg").textContent = `Built ${n} bottles (capacity fixed to 4).`;
    el("status").textContent = "Fill all non-helper bottles. Solve unlocks when input is valid.";
    el("output").textContent = "Ready.";

    renderAllLayers();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function onLayerClick(b, l) {
    const n = state.bottleLayers.length;
    if (!n) return;
    if (b >= n - 2) return;

    if (state.selectedLayer && state.selectedLayer.b === b && state.selectedLayer.l === l) {
      setLayerColor(b, l, "", true);
      state.selectedLayer = null;
      state.openPopoverBottle = null;
      closeAllPopovers();
      renderAllLayers();
      runContinuousValidation();
      updateSolveEnabled();
      return;
    }

    state.selectedLayer = { b, l };
    state.openPopoverBottle = b;
    closeAllPopovers();
    openPopover(b);
    renderAllLayers();
    renderPopover(b);
  }

  function openPopover(b) {
    const pop = el(`popover-${b}`);
    if (!pop) return;
    pop.classList.add("open");
  }

  function closeAllPopovers() {
    const area = el("bottleArea");
    area.querySelectorAll(".popover").forEach((p) => p.classList.remove("open"));
  }

  function renderPopover(b) {
    if (b === null || b === undefined) return;
    const pop = el(`popover-${b}`);
    if (!pop) return;

    const colors = selectedColors();
    const counts = computeUsedCounts();

    if (!state.selectedLayer || state.selectedLayer.b !== b) {
      pop.innerHTML = "";
      return;
    }

    pop.innerHTML = "";

    const top = document.createElement("div");
    top.className = "popover-top";

    const left = document.createElement("div");
    left.className = "small";
    left.textContent = `Bottle ${b + 1} • Layer ${state.selectedLayer.l + 1}`;

    const actions = document.createElement("div");
    actions.className = "popover-actions";

    const close = document.createElement("button");
    close.textContent = "Close";
    close.addEventListener("click", () => {
      state.selectedLayer = null;
      state.openPopoverBottle = null;
      closeAllPopovers();
      renderAllLayers();
    });

    actions.appendChild(close);
    top.appendChild(left);
    top.appendChild(actions);
    pop.appendChild(top);

    const grid = document.createElement("div");
    grid.className = "palette-grid";

    for (const c of colors) {
      const remaining = CAP - (counts[c] || 0);
      if (remaining <= 0) continue;

      const box = document.createElement("div");
      box.className = "cbox";
      box.style.background = COLOR_PALETTE[c] || "#ddd";

      const num = document.createElement("div");
      num.className = "cnum";
      num.textContent = String(remaining);

      box.appendChild(num);
      box.addEventListener("click", () => {
        setLayerColor(state.selectedLayer.b, state.selectedLayer.l, c, true);

        const next = findNextEmptyLayerInBottle(state.selectedLayer.b, state.selectedLayer.l);
        if (next !== null) {
          state.selectedLayer = { b: state.selectedLayer.b, l: next };
          state.openPopoverBottle = state.selectedLayer.b;
          renderAllLayers();
          renderPopover(state.selectedLayer.b);
        } else {
          renderAllLayers();
          renderPopover(state.selectedLayer.b);
        }
        runContinuousValidation();
        updateSolveEnabled();
      });

      grid.appendChild(box);
    }

    pop.appendChild(grid);
  }

  function findNextEmptyLayerInBottle(b, startL) {
    for (let l = startL + 1; l < CAP; l++) if (!state.bottleLayers[b][l]) return l;
    for (let l = 0; l <= startL; l++) if (!state.bottleLayers[b][l]) return l;
    return null;
  }

  function setLayerColor(b, l, color, pushHistory = false) {
    const prev = state.bottleLayers[b][l];
    if (prev === color) return;

    if (color) {
      const colors = selectedColors();
      if (!colors.includes(color)) return;

      const counts = computeUsedCounts();
      const remaining = CAP - (counts[color] || 0);
      if (remaining <= 0) return;
    }

    state.bottleLayers[b][l] = color;

    if (pushHistory) {
      state.inputHistory.push({ b, l, prev, next: color });
      el("undoBtn").disabled = state.inputHistory.length === 0;
    }

    renderAllLayers();
    if (state.openPopoverBottle !== null) renderPopover(state.openPopoverBottle);
  }

  function undoLastInput() {
    const rec = state.inputHistory.pop();
    if (!rec) return;
    state.bottleLayers[rec.b][rec.l] = rec.prev;
    el("undoBtn").disabled = state.inputHistory.length === 0;

    renderAllLayers();
    runContinuousValidation();
    updateSolveEnabled();
    if (state.openPopoverBottle !== null) renderPopover(state.openPopoverBottle);
  }

  function renderAllLayers() {
    const area = el("bottleArea");
    if (!area || !state.bottleLayers.length) return;

    area.querySelectorAll(".layer").forEach((div) => {
      const b = parseInt(div.dataset.bottle, 10);
      const l = parseInt(div.dataset.layer, 10);
      if (b >= state.bottleLayers.length - 2) return;

      const color = state.bottleLayers[b][l] || "";
      div.classList.toggle(
        "selected",
        !!state.selectedLayer && state.selectedLayer.b === b && state.selectedLayer.l === l
      );

      if (!color) {
        div.classList.add("empty");
        div.style.backgroundColor = "#fff";
        div.style.color = "#999";
        div.querySelector(".tag").textContent = "Tap to set";
      } else {
        div.classList.remove("empty");
        div.style.backgroundColor = COLOR_PALETTE[color] || "#ddd";
        div.style.color =
          color === "Yellow" || color === "Light Blue" || color === "Light Green" ? "#111" : "#fff";
        div.querySelector(".tag").textContent = color;
      }
    });
  }

  return {
    updateSelectAllVisibility,
    updateColorLimitUI,
    buildChecklist,
    selectAllColors,
    buildBottlesUI,
    onLayerClick,
    openPopover,
    closeAllPopovers,
    renderPopover,
    setLayerColor,
    undoLastInput,
    renderAllLayers,
  };
}
