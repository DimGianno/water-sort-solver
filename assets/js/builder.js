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
    el("colorLimitHint").textContent = `${chosen}/${max} selected`;

    const checkboxes = Array.from(
      el("colorChecklist").querySelectorAll('input[type="checkbox"]'),
    );
    const lock = chosen >= max;
    for (const checkbox of checkboxes)
      checkbox.disabled = !checkbox.checked && lock;
  }

  function buildChecklist() {
    const box = el("colorChecklist");
    box.innerHTML = "";

    DEFAULT_COLORS.forEach((color) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = color;
      checkbox.addEventListener("change", () => {
        if (selectedColors().length > colorMaxAllowed())
          checkbox.checked = false;
        updateColorLimitUI();

        if (state.bottleLayers.length) {
          if (
            state.activeColor &&
            !selectedColors().includes(state.activeColor)
          )
            state.activeColor = null;
          renderAllLayers();
          renderPalette();
          runContinuousValidation();
          updateSolveEnabled();
        }
      });

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = COLOR_PALETTE[color] || "#ccc";

      const name = document.createElement("span");
      name.textContent = color;

      label.append(checkbox, swatch, name);
      box.appendChild(label);
    });

    updateSelectAllVisibility();
    updateColorLimitUI();
  }

  function selectAllColors() {
    if (parseInt(el("numBottles").value, 10) !== 14) return;

    el("colorChecklist")
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.checked = true;
      });

    updateColorLimitUI();
    if (state.bottleLayers.length) {
      renderAllLayers();
      renderPalette();
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

    if (!Number.isFinite(n) || n < 4)
      return showError("Number of bottles must be at least 4.");
    if (n > 14) return showError("The maximum is 14 bottles.");

    const maxColors = n - 2;
    if (colors.length !== maxColors)
      return showError(`Select exactly ${maxColors} colors.`);

    state.bottleLayers = Array.from({ length: n }, () => Array(CAP).fill(""));
    state.selectedLayer = { b: 0, l: 0 };
    state.openPopoverBottle = null;
    state.activeColor = null;
    state.fillMode = el("fillModeColor").checked ? "color" : "layer";
    state.lastSolution = null;
    hideReplay();

    const area = el("bottleArea");
    area.innerHTML = "";
    area.className = "board";

    const rows = [document.createElement("div"), document.createElement("div")];
    rows.forEach((row) => {
      row.className = "board-row";
      area.appendChild(row);
    });

    const split = Math.ceil(n / 2);
    for (let bottleIndex = 0; bottleIndex < n; bottleIndex++) {
      const isHelper = bottleIndex >= n - 2;
      const bottle = document.createElement("div");
      bottle.className = `bottle${isHelper ? " helper-bottle" : ""}`;
      bottle.dataset.bottle = String(bottleIndex);

      const title = document.createElement("div");
      title.className = "bottle-title";
      title.innerHTML = `<span>${bottleIndex + 1}</span>${isHelper ? '<span class="helper-label">helper</span>' : ""}`;

      const layers = document.createElement("div");
      layers.className = "layers";

      for (let layerIndex = 0; layerIndex < CAP; layerIndex++) {
        const layer = document.createElement("button");
        layer.type = "button";
        layer.className = "layer empty";
        layer.dataset.bottle = String(bottleIndex);
        layer.dataset.layer = String(layerIndex);
        layer.setAttribute(
          "aria-label",
          `Bottle ${bottleIndex + 1}, layer ${layerIndex + 1}, empty`,
        );

        if (isHelper) {
          layer.disabled = true;
        } else {
          layer.addEventListener("click", () =>
            onLayerClick(bottleIndex, layerIndex),
          );
        }
        layers.appendChild(layer);
      }

      bottle.append(title, layers);
      rows[bottleIndex < split ? 0 : 1].appendChild(bottle);
    }

    el("fillToolbar").hidden = false;
    el("buildMsg").textContent = `${n} bottles ready`;
    el("status").textContent =
      "Fill every non-helper bottle to unlock the solver.";
    el("output").textContent = "Ready.";

    renderAllLayers();
    renderPalette();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function onLayerClick(bottleIndex, layerIndex) {
    const editableBottles = state.bottleLayers.length - 2;
    if (!state.bottleLayers.length || bottleIndex >= editableBottles) return;

    state.selectedLayer = { b: bottleIndex, l: layerIndex };

    if (state.fillMode === "color" && state.activeColor) {
      const changed = setLayerColor(bottleIndex, layerIndex, state.activeColor);
      if (changed && remainingFor(state.activeColor) === 0)
        state.activeColor = null;
    }

    renderAllLayers();
    renderPalette();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function setFillMode(mode) {
    state.fillMode = mode === "color" ? "color" : "layer";
    state.activeColor = null;

    if (
      state.fillMode === "layer" &&
      state.bottleLayers.length &&
      !state.selectedLayer
    ) {
      state.selectedLayer = findNextEmptyLayer(-1, CAP - 1);
    }

    renderAllLayers();
    renderPalette();
  }

  function onPaletteColor(color) {
    if (remainingFor(color) <= 0) return;

    if (state.fillMode === "color") {
      state.activeColor = state.activeColor === color ? null : color;
      renderPalette();
      return;
    }

    if (!state.selectedLayer)
      state.selectedLayer = findNextEmptyLayer(-1, CAP - 1);
    if (!state.selectedLayer) return;

    const { b, l } = state.selectedLayer;
    if (!setLayerColor(b, l, color)) return;
    state.selectedLayer = findNextEmptyLayer(b, l);

    renderAllLayers();
    renderPalette();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function clearSelectedLayer() {
    if (!state.selectedLayer) return;
    const { b, l } = state.selectedLayer;
    if (!state.bottleLayers[b][l]) return;

    setLayerColor(b, l, "");
    renderAllLayers();
    renderPalette();
    runContinuousValidation();
    updateSolveEnabled();
  }

  function remainingFor(color) {
    const counts = computeUsedCounts();
    return CAP - (counts[color] || 0);
  }

  function findNextEmptyLayer(bottleIndex, layerIndex) {
    const editableBottles = Math.max(0, state.bottleLayers.length - 2);
    const totalLayers = editableBottles * CAP;
    if (!totalLayers) return null;

    const start = bottleIndex < 0 ? -1 : bottleIndex * CAP + layerIndex;
    for (let offset = 1; offset <= totalLayers; offset++) {
      const flatIndex = (start + offset + totalLayers) % totalLayers;
      const b = Math.floor(flatIndex / CAP);
      const l = flatIndex % CAP;
      if (!state.bottleLayers[b][l]) return { b, l };
    }
    return null;
  }

  function setLayerColor(bottleIndex, layerIndex, color) {
    const previous = state.bottleLayers[bottleIndex][layerIndex];
    if (previous === color) return false;

    if (color) {
      if (!selectedColors().includes(color)) return false;
      if (remainingFor(color) <= 0) return false;
    }

    state.bottleLayers[bottleIndex][layerIndex] = color;
    return true;
  }

  function renderAllLayers() {
    const area = el("bottleArea");
    if (!area || !state.bottleLayers.length) return;

    area.querySelectorAll(".layer").forEach((layer) => {
      const b = parseInt(layer.dataset.bottle, 10);
      const l = parseInt(layer.dataset.layer, 10);
      const color = state.bottleLayers[b][l] || "";
      const isHelper = b >= state.bottleLayers.length - 2;

      layer.classList.toggle(
        "selected",
        !isHelper &&
          !!state.selectedLayer &&
          state.selectedLayer.b === b &&
          state.selectedLayer.l === l,
      );
      layer.classList.toggle("empty", !color);
      layer.style.backgroundColor = color ? COLOR_PALETTE[color] || "#ddd" : "";
      layer.setAttribute(
        "aria-label",
        `Bottle ${b + 1}, layer ${l + 1}, ${isHelper ? "helper" : color || "empty"}`,
      );
    });
  }

  function renderPalette() {
    const palette = el("fillPalette");
    if (!palette) return;
    palette.innerHTML = "";

    if (!state.bottleLayers.length) return;

    const colors = selectedColors();
    const counts = computeUsedCounts();
    if (state.activeColor && CAP - (counts[state.activeColor] || 0) <= 0)
      state.activeColor = null;

    const selected = state.selectedLayer;
    const selectedValue = selected
      ? state.bottleLayers[selected.b][selected.l]
      : "";
    el("clearLayerBtn").disabled = !selectedValue;

    if (state.fillMode === "color") {
      el("paletteTitle").textContent = state.activeColor
        ? `${state.activeColor} selected - tap layers`
        : "Choose a color, then tap layers";
    } else {
      el("paletteTitle").textContent = selected
        ? `Bottle ${selected.b + 1} - layer ${selected.l + 1}`
        : "All layers are filled";
    }

    for (const color of colors) {
      const remaining = CAP - (counts[color] || 0);
      if (remaining <= 0) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = `palette-color${state.activeColor === color ? " active" : ""}`;
      button.setAttribute("aria-label", `${color}, ${remaining} remaining`);
      button.setAttribute("aria-pressed", String(state.activeColor === color));

      const swatch = document.createElement("span");
      swatch.className = "palette-swatch";
      swatch.style.background = COLOR_PALETTE[color] || "#ddd";

      const name = document.createElement("span");
      name.className = "palette-name";
      name.textContent = color;

      const counter = document.createElement("span");
      counter.className = "palette-count";
      counter.textContent = String(remaining);

      button.append(swatch, name, counter);
      button.addEventListener("click", () => onPaletteColor(color));
      palette.appendChild(button);
    }

    if (!palette.children.length) {
      const complete = document.createElement("span");
      complete.className = "palette-complete";
      complete.textContent = "All color pieces are placed.";
      palette.appendChild(complete);
    }
  }

  function closeAllPopovers() {
    state.openPopoverBottle = null;
  }

  function openPopover() {
    renderPalette();
  }

  function renderPopover() {
    renderPalette();
  }

  el("fillModeLayer").addEventListener("change", () => {
    if (el("fillModeLayer").checked) setFillMode("layer");
  });
  el("fillModeColor").addEventListener("change", () => {
    if (el("fillModeColor").checked) setFillMode("color");
  });
  el("clearLayerBtn").addEventListener("click", clearSelectedLayer);

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
    renderAllLayers,
    renderPalette,
  };
}
