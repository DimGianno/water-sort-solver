export type Color = string;
export type Bottle = Color[];
export type PuzzleState = Bottle[];
export type SolverMode = "fast" | "optimal";

export interface SolverMove {
  from: number;
  to: number;
  amt: number;
  color: Color;
}

export interface SolverSuccess {
  ok: true;
  moves: SolverMove[];
  explored: number;
}

export interface SolverFailure {
  ok: false;
  reason: string;
  explored: number;
}

export type SolverResult = SolverSuccess | SolverFailure;

export interface ReplaySolution {
  moves: SolverMove[];
  states: PuzzleState[];
}

export interface SolverOptions {
  cap?: number;
  onProgress?: (expanded: number) => void;
}

export interface SolveWorkerRequest {
  type: "solve";
  requestId: number;
  bottles: PuzzleState;
  mode: SolverMode;
  cap: number;
}

export interface SolverProgressMessage {
  type: "progress";
  requestId: number;
  expanded: number;
}

export interface SolverResultMessage {
  type: "result";
  requestId: number;
  result: SolverResult;
}

export interface SolverErrorMessage {
  type: "error";
  requestId: number;
  message: string;
}

export type SolverWorkerMessage =
  SolverProgressMessage | SolverResultMessage | SolverErrorMessage;
