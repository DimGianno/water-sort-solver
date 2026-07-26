export const CAP = 4;

export const COLOR_PALETTE = {
  Red: "#e53935",
  Pink: "#ec407a",
  Orange: "#fb8c00",
  Yellow: "#fdd835",
  Green: "#43a047",
  "Dark Green": "#1b5e20",
  "Light Green": "#9ccc65",
  Blue: "#1e88e5",
  "Light Blue": "#81d4fa",
  Purple: "#8e24aa",
  Gray: "#9e9e9e",
  Brown: "#6d4c41",
} as const;

export type ColorName = keyof typeof COLOR_PALETTE;

export const DEFAULT_COLORS = Object.keys(COLOR_PALETTE) as ColorName[];

export const SAMPLE_PUZZLE = {
  v: 1,
  n: 14,
  colors: DEFAULT_COLORS,
  layers: [
    ["Green", "Yellow", "Dark Green", "Pink"],
    ["Blue", "Gray", "Light Blue", "Brown"],
    ["Brown", "Purple", "Brown", "Light Green"],
    ["Light Blue", "Blue", "Light Green", "Purple"],
    ["Dark Green", "Light Green", "Gray", "Green"],
    ["Purple", "Red", "Light Green", "Pink"],
    ["Red", "Orange", "Green", "Pink"],
    ["Brown", "Dark Green", "Light Blue", "Orange"],
    ["Red", "Gray", "Blue", "Orange"],
    ["Yellow", "Dark Green", "Red", "Orange"],
    ["Yellow", "Light Blue", "Blue", "Green"],
    ["Purple", "Gray", "Pink", "Yellow"],
    ["", "", "", ""],
    ["", "", "", ""],
  ],
};
