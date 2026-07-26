/// <reference lib="webworker" />

import { aStarSolve } from "./solver-core.js";
import type {
  SolveWorkerRequest,
  SolverResult,
  SolverWorkerMessage,
} from "./solver-types.ts";

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  const request = event.data as SolveWorkerRequest | null;
  if (!request || request.type !== "solve") return;

  const { requestId, bottles, mode, cap } = request;
  try {
    const result = aStarSolve(bottles, mode, {
      cap,
      onProgress(expanded: number) {
        const message: SolverWorkerMessage = {
          type: "progress",
          requestId,
          expanded,
        };
        worker.postMessage(message);
      },
    }) as SolverResult;
    const message: SolverWorkerMessage = { type: "result", requestId, result };
    worker.postMessage(message);
  } catch (error) {
    const message: SolverWorkerMessage = {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    worker.postMessage(message);
  }
});
