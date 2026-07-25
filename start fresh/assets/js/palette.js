// palette.js
// Single source of truth for colors used across the app.

export const PALETTE = [
  { id: "red", name: "Red", hex: "#B5392D" },
  { id: "orange", name: "Orange", hex: "#DA904F" },
  { id: "yellow", name: "Yellow", hex: "#EDDB6D" },
  { id: "green", name: "Green", hex: "#7D9630" },
  { id: "blue", name: "Blue", hex: "#3A2FBC" },
  { id: "purple", name: "Purple", hex: "#69308F" },
  { id: "pink", name: "Pink", hex: "#DA667B" },
  { id: "cyan", name: "Cyan", hex: "#67A1E0" },
  { id: "lime", name: "Lime", hex: "#81D486" },
  { id: "brown", name: "Brown", hex: "#764C1A" },
  { id: "gray", name: "Gray", hex: "#646466" },
  { id: "dark green", name: "Dark Green", hex: "#2E6339" },
];

export const COLOR_BY_ID = Object.fromEntries(PALETTE.map(c => [c.id, c]));

export function colorName(id) {
  return COLOR_BY_ID[id]?.name ?? id;
}

export function colorHex(id) {
  return COLOR_BY_ID[id]?.hex ?? "#000000";
}
