import type { ReplaySolution } from "./solver-types.ts";

export type FillMode = "layer" | "color";

export interface SelectedLayer {
  b: number;
  l: number;
}

export interface AppState {
  bottleLayers: string[][];
  selectedLayer: SelectedLayer | null;
  openPopoverBottle: number | null;
  lastSolution: ReplaySolution | null;
  replayTimer: ReturnType<typeof setInterval> | null;
  replayIndex: number;
  fillMode: FillMode;
  activeColor: string | null;
  isSolving: boolean;
  revealReplayOnSolve: boolean;
  inputHistory?: unknown[];
}

export type ElementLookup = <T extends HTMLElement = HTMLElement>(
  id: string,
) => T;
