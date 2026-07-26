import { aStarSolve } from "./solver-core.js";

self.addEventListener("message", (event) => {
  const request = event.data;
  if (!request || request.type !== "solve") return;

  const { requestId, bottles, mode, cap } = request;
  try {
    const result = aStarSolve(bottles, mode, {
      cap,
      onProgress(expanded) {
        self.postMessage({ type: "progress", requestId, expanded });
      },
    });
    self.postMessage({ type: "result", requestId, result });
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      message: error?.message || String(error),
    });
  }
});
