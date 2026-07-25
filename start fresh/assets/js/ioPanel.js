import { PALETTE } from "./palette.js";
// ioPanel.js
// UI-only module: open/close modal, parse JSON, call app callbacks.

export function initIOPanel(options = {}) {
  const { onImport, getExportData } = options;

  const ioBtn = document.getElementById("ioBtn");
  const overlay = document.getElementById("ioOverlay");
  const modal = document.getElementById("ioModal");
  const text = document.getElementById("ioText");
  const msg = document.getElementById("ioMsg");
  const closeBtn = document.getElementById("ioCloseBtn");
  const exportBtn = document.getElementById("ioExportBtn");
  const importBtn = document.getElementById("ioImportBtn");

  const ID_TO_NAME = Object.fromEntries(PALETTE.map(c => [c.id, c.name]));
  const NAME_TO_ID = Object.fromEntries(PALETTE.map(c => [c.name.toLowerCase(), c.id]));
  const ID_SET = new Set(PALETTE.map(c => c.id));

  if (!ioBtn || !overlay || !modal || !text || !msg || !closeBtn || !exportBtn || !importBtn) {
    console.warn("IOPanel: missing HTML elements");
    overlay.hidden = true;
    return {};
  }

  // Helper functions for encoding/decoding WS1 compact format (base64-encoded JSON with color names instead of ids).
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function toId(token) {
    if (!token) return "";
    const t = String(token).trim();
    if (!t) return "";
    const low = t.toLowerCase();

    // If already an id like "red"
    if (ID_SET.has(low)) return low;

    // If a name like "Red"
    if (NAME_TO_ID[low]) return NAME_TO_ID[low];

    // fallback (app.js will reject unknown ids via COLOR_BY_ID)
    return low;
  }

  function toName(id) {
    if (!id) return "";
    return ID_TO_NAME[id] ?? id;
  }

  function toWS1(data) {
    const n = data.bottleCount;
    const colors = (data.selectedColors || []).map(toName);

    const layers = (data.draft || Array.from({ length: n }, () => Array(4).fill("")))
      .map(bottle => bottle.map(v => (v === "" ? "" : toName(v))));

    return { v: 1, n, colors, layers };
  }

  function fromWS1(ws) {
    const bottleCount = ws.n;
    const selectedColors = (ws.colors || []).map(toId);
    const draft = (ws.layers || []).map(b => b.map(v => (v === "" ? "" : toId(v))));

    return { version: 1, bottleCount, selectedColors, draft };
  }

  // Open/close modal
  function open() {
    overlay.hidden = false;
    msg.textContent = "";
    // Don’t wipe text automatically; user might be editing it.
    setTimeout(() => text.focus(), 0);
  }

  function close() {
    overlay.hidden = true;
    text.value = "";
    msg.textContent = "";
  }

  // Open modal
  ioBtn.addEventListener("click", open);

  // Close button
  closeBtn.addEventListener("click", close);

  // Click outside modal closes
  overlay.addEventListener("click", close);

  // Clicking inside modal should NOT close
  modal.addEventListener("click", (e) => e.stopPropagation());

  // Export
  exportBtn.addEventListener("click", async () => {
    msg.textContent = "";
    const data = (typeof getExportData === "function") ? getExportData() : null;

    if (!data) {
      msg.textContent = "Nothing to export yet (build a puzzle first).";
      return;
    }

    const wsObj = toWS1(data);
    const payload = JSON.stringify(wsObj);
    const code = "WS1:" + toBase64(payload);

    text.value = code;

    // Optional: auto-copy
    try {
      await navigator.clipboard.writeText(code);
      msg.textContent = "Exported and copied to clipboard ✅";
    } catch {
      msg.textContent = "Exported ✅ (copy manually if clipboard is blocked).";
    }
  });

  // Import
  importBtn.addEventListener("click", () => {
    const raw = text.value.trim();
    msg.textContent = "";

    let obj;
    
    try {
      if (raw.startsWith("WS1:")) {
        const b64 = raw.slice(4);
        const json = fromBase64(b64);
        const wsObj = JSON.parse(json);
        obj = fromWS1(wsObj); // convert to internal format for app.js
      } else {
        // Optional: still support plain JSON imports
        obj = JSON.parse(raw);
      }
    } catch {
      msg.textContent = "Invalid import text. Paste a WS1:... code (or valid JSON).";
      return;
    }


    if (typeof onImport !== "function") return;

    let res;
    try {
      res = onImport(obj);
    } catch (err) {
      msg.textContent = `Import crashed: ${err?.message || err}`;
      return;
    }


    if (res?.ok) {
      msg.textContent = res.msg || "Imported ✅";
      // Close after a short moment so user sees the success message
      setTimeout(close, 200);
    } else {
      msg.textContent = res?.msg || "Import failed.";
    }
  });

  return { open, close };
}
