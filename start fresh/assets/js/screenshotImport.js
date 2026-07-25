import { PALETTE } from "./palette.js";
// screenshotImport.js
// Commit 1: Offline screenshot loader + preview + canvas draw (no detection yet).

export function initScreenshotImport(options = {}) {
  const { onLoaded, onImportPuzzle } = options;

  const btn = document.getElementById("shotBtn");
  const overlay = document.getElementById("shotOverlay");
  const modal = document.getElementById("shotModal");
  const fileEl = document.getElementById("shotFile");
  const msgEl = document.getElementById("shotMsg");
  const imgEl = document.getElementById("shotImg");
  const closeBtn = document.getElementById("shotCloseBtn");
  const clearBtn = document.getElementById("shotClearBtn");
  const importBtn = document.getElementById("shotImportBtn");


  const stageEl = document.getElementById("shotStage");
  const canvasEl = document.getElementById("shotCanvas");
  const controlsEl = document.getElementById("shotControls");
  const bottlesEl = document.getElementById("shotBottles");
  const xEl = document.getElementById("shotX");
  const yEl = document.getElementById("shotY");
  const wEl = document.getElementById("shotW");
  const hEl = document.getElementById("shotH");
  const gapXEl = document.getElementById("shotGapX");
  const gapYEl = document.getElementById("shotGapY");
  const gapX2El = document.getElementById("shotGapX2");


  let resizeHooked = false;


  if (!btn || !overlay || !modal || !fileEl || !msgEl || !imgEl || !closeBtn || !clearBtn || !importBtn || !stageEl || !canvasEl || !controlsEl || !bottlesEl || !xEl || !yEl || !wEl || !hEl || !gapXEl || !gapYEl || !gapX2El) {
    console.warn("ScreenshotImport: missing HTML elements");
    return {};
  }

  function splitIntoTwoRows(n) {
     const first = Math.ceil(n / 2);
     const second = n - first;
     return { first, second };
  }

  const CAP = 4;

   function hexToRgb(hex) {
     const h = hex.replace("#", "");
     const n = parseInt(h, 16);
     return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
   }

    const PALETTE_RGB = PALETTE.map(c => ({ id: c.id, rgb: hexToRgb(c.hex) }));

   function dist2(a, b) {
      const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
      return dr * dr + dg * dg + db * db;
    }

    // If best match is still too far, treat as "empty"
    const EMPTY_THRESHOLD2 = 90 * 90;

    function nearestPaletteId(rgb) {
        let bestId = "";
        let bestD2 = Infinity;

        for (const p of PALETTE_RGB) {
            const d2 = dist2(rgb, p.rgb);
            if (d2 < bestD2) {
            bestD2 = d2;
            bestId = p.id;
            }
        }
        return (bestD2 > EMPTY_THRESHOLD2) ? "" : bestId;
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // This MUST be global (used by drawGrid + import)
    function getBottleRect(i, s) {
        const { n, x, y, bw, bh, gx, gy, gx2 } = s;
        const { first, second } = splitIntoTwoRows(n);

        const row = (i < first) ? 0 : 1;
        const col = (row === 0) ? i : (i - first);

        // widths of each row (so we can center row2 under row1 even if gx2 differs)
        const row1Width = first * bw + (first - 1) * gx;
        const row2Width = second * bw + (second - 1) * gx2;

        const rowOffset = (row === 1) ? (row1Width - row2Width) / 2 : 0;

        const stepX = (row === 1) ? (bw + gx2) : (bw + gx);

        return {
            x: x + rowOffset + col * stepX,
            y: y + row * (bh + gy),
            w: bw,
            h: bh,
        };
    }

    // Average a small patch in the FULL-RES canvas
    function avgRgbAtNat(ctx, canvas, nx, ny, size = 9) {
        const half = Math.floor(size / 2);
        const x0 = clamp(Math.round(nx - half), 0, canvas.width - size);
        const y0 = clamp(Math.round(ny - half), 0, canvas.height - size);

        const data = ctx.getImageData(x0, y0, size, size).data;

        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
        }
        return { r: r / n, g: g / n, b: b / n };
    }


    function pickByMajority(ids) {
        const m = new Map();
        for (const id of ids) {
            m.set(id, (m.get(id) || 0) + 1);
        }
        // pick the most common
        let best = "";
        let bestCount = -1;
        for (const [id, c] of m.entries()) {
            if (c > bestCount) {
            best = id;
            bestCount = c;
            }
        }
        return best;
    }



function getSettings() {
  return {
    n: Number(bottlesEl.value),
    x: Number(xEl.value),
    y: Number(yEl.value),
    bw: Number(wEl.value),
    bh: Number(hEl.value),
    gx: Number(gapXEl.value),
    gy: Number(gapYEl.value),
    gx2: Number(gapX2El.value),
  };
}

function setXY(x, y) {
  xEl.value = String(Math.round(x));
  yEl.value = String(Math.round(y));
}

function resizeOverlayToImage() {
  const dpr = window.devicePixelRatio || 1;

  const cssW = imgEl.clientWidth;
  const cssH = imgEl.clientHeight;

  canvasEl.style.width = `${cssW}px`;
  canvasEl.style.height = `${cssH}px`;

  canvasEl.width = Math.round(cssW * dpr);
  canvasEl.height = Math.round(cssH * dpr);

  const c2 = canvasEl.getContext("2d");
  c2.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}

function drawGrid() {
  const c2 = canvasEl.getContext("2d");
  const s = getSettings();

  const cssW = imgEl.clientWidth;
  const cssH = imgEl.clientHeight;

  c2.clearRect(0, 0, cssW, cssH);

  // style
  c2.lineWidth = 2;
  c2.strokeStyle = "rgba(255,255,255,0.85)";
  c2.fillStyle = "rgba(255,255,255,0.12)";

  for (let i = 0; i < s.n; i++) {
        const r = getBottleRect(i, s);
        const bx = r.x, by = r.y, bw = r.w, bh = r.h;

        // bottle rectangle
        c2.beginPath();
        c2.roundRect(bx, by, bw, bh, 10);
        c2.fill();
        c2.stroke();

        // 4 layer separators
        c2.strokeStyle = "rgba(255,255,255,0.45)";
        for (let k = 1; k < 4; k++) {
            const yy = by + (bh * k) / 4;
            c2.beginPath();
            c2.moveTo(bx + 6, yy);
            c2.lineTo(bx + bw - 6, yy);
            c2.stroke();
        }

        // restore main stroke style + bottle index
        c2.strokeStyle = "rgba(255,255,255,0.85)";
        c2.fillStyle = "rgba(0,0,0,0.6)";
        c2.font = "12px system-ui";
        c2.fillText(String(i + 1), bx + 6, by + 16);
        c2.fillStyle = "rgba(255,255,255,0.12)";
  }

}

function hookControlChanges() {
  const inputs = [bottlesEl, xEl, yEl, wEl, hEl, gapXEl, gapYEl, gapX2El];
  for (const el of inputs) {
    el.addEventListener("input", () => drawGrid());
  }
}

hookControlChanges();

let dragging = false;
let dragStart = { x: 0, y: 0 };
let startXY = { x: 0, y: 0 };

canvasEl.addEventListener("pointerdown", (e) => {
  dragging = true;
  canvasEl.setPointerCapture(e.pointerId);

  dragStart = { x: e.clientX, y: e.clientY };
  startXY = { x: Number(xEl.value), y: Number(yEl.value) };
});

canvasEl.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;

  setXY(startXY.x + dx, startXY.y + dy);
  drawGrid();
});

canvasEl.addEventListener("pointerup", () => dragging = false);
canvasEl.addEventListener("pointercancel", () => dragging = false);



  // Hidden canvas (created in JS)
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let objectUrl = null;

  function resetUI() {
    importBtn.disabled = true;
    stageEl.hidden = true;
    canvasEl.hidden = true;
    controlsEl.hidden = true;

    msgEl.textContent = "";
    imgEl.hidden = true;
    imgEl.src = "";
    clearBtn.disabled = true;
    fileEl.value = "";
  }

  function open() {
    overlay.hidden = false;
    msgEl.textContent = "Choose a screenshot…";
  }

  function close() {
    overlay.hidden = true;
    resetUI();

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  btn.addEventListener("click", open);

  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", close);
  modal.addEventListener("click", (e) => e.stopPropagation());

  clearBtn.addEventListener("click", () => {
    resetUI();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    msgEl.textContent = "Cleared. Choose a screenshot…";
  });

  fileEl.addEventListener("change", () => {
    const file = fileEl.files?.[0];
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    imgEl.hidden = false;
    imgEl.src = objectUrl;

    msgEl.textContent = "Loading image…";

    imgEl.onload = () => {
        importBtn.disabled = false;
        stageEl.hidden = false;
        canvasEl.hidden = false;
        controlsEl.hidden = false;

        resizeOverlayToImage();

        // auto defaults based on image size (good starting point)
        const imgW = imgEl.clientWidth;
        const imgH = imgEl.clientHeight;

        bottlesEl.value = "14";
        wEl.value = String(Math.round(imgW / 8));       // rough
        hEl.value = String(Math.round(imgH * 0.22));    // rough
        gapXEl.value = String(Math.round(imgW * 0.02));
        gapYEl.value = String(Math.round(imgH * 0.06));
        gapX2El.value = String(Math.round(imgW * 0.02));
        setXY(Math.round(imgW * 0.07), Math.round(imgH * 0.30));

        drawGrid();

        if (!resizeHooked) {
            window.addEventListener("resize", () => {
                if (overlay.hidden) return;
                if (imgEl.hidden) return;
                resizeOverlayToImage();
                drawGrid();
            });
            resizeHooked = true;
        }


      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(imgEl, 0, 0);

      msgEl.textContent = `Loaded: ${w} × ${h}px`;
      clearBtn.disabled = false;

      // For next commits: send canvas + ctx upstream
      if (typeof onLoaded === "function") {
        onLoaded({ canvas, ctx, width: w, height: h });
      }
    };

    imgEl.onerror = () => {
      msgEl.textContent = "Failed to load image.";
      imgEl.hidden = true;
      clearBtn.disabled = true;
    };
  });

  importBtn.addEventListener("click", () => {
    // Need an image loaded
    if (imgEl.hidden) return;

    const s = getSettings();

    // Convert overlay (CSS) coords -> natural image coords
    const sx = imgEl.naturalWidth / imgEl.clientWidth;
    const sy = imgEl.naturalHeight / imgEl.clientHeight;

    const draft = Array.from({ length: s.n }, () => Array(CAP).fill(""));

    for (let b = 0; b < s.n; b++) {
        const r = getBottleRect(b, s);

        for (let l = 0; l < CAP; l++) {
            // layer center (top->bottom)
            const layerTop = r.y + (r.h * l) / CAP;
            const layerH = r.h / CAP;

            // sample safely inside the liquid area (avoid edges)
            const xPoints = [0.35, 0.50, 0.65];
            const yPoints = [0.35, 0.65];

            const ids = [];
            for (const xp of xPoints) {
            for (const yp of yPoints) {
                const cx = r.x + r.w * xp;
                const cy = layerTop + layerH * yp;

                const nx = cx * sx;
                const ny = cy * sy;

                const rgb = avgRgbAtNat(ctx, canvas, nx, ny, 7); // smaller patch helps
                ids.push(nearestPaletteId(rgb));
            }
            }

            // majority vote (robust against 1 bad point)
            draft[b][l] = pickByMajority(ids);
        }
    }

    // Infer selected colors (palette order for stability)
    const used = new Set();
    for (let b = 0; b < s.n; b++) {
        for (let l = 0; l < CAP; l++) {
        const v = draft[b][l];
        if (v) used.add(v);
        }
    }
    const selectedColors = PALETTE.map(c => c.id).filter(id => used.has(id));

    const required = s.n - 2;

    // Basic validation (matches your app rules)
    if (selectedColors.length !== required) {
        msgEl.textContent = `Detection error: found ${selectedColors.length} colors but expected ${required}. Try adjusting the grid or threshold.`;
        return;
    }

    // Helpers must be empty
    for (let b = required; b < s.n; b++) {
        if (draft[b].some(v => v !== "")) {
        msgEl.textContent = "Detection error: last 2 bottles must be empty helpers. Align grid to match the screenshot.";
        return;
        }
    }

    // Each color should appear exactly 4 times in main bottles
    const counts = Object.fromEntries(selectedColors.map(id => [id, 0]));
    for (let b = 0; b < required; b++) {
        for (let l = 0; l < CAP; l++) {
        const v = draft[b][l];
        if (!counts.hasOwnProperty(v)) {
            msgEl.textContent = "Detection error: a layer mapped to a color not in the selected set.";
            return;
        }
        counts[v] += 1;
        }
    }
    for (const id of selectedColors) {
        if (counts[id] !== 4) {
        msgEl.textContent = `Detection error: ${id} counted ${counts[id]}/4. Try re-aligning grid.`;
        return;
        }
    }

    // Hand off to app.js
    if (typeof onImportPuzzle === "function") {
        const r = onImportPuzzle({
        bottleCount: s.n,
        selectedColors,
        draft,
        });

        if (r && r.ok === false) {
        msgEl.textContent = r.msg || "Import failed.";
        return;
        }
    }

    msgEl.textContent = "Imported ✅";
    close();
  });


  return { open, close };
}
