import { describe, expect, test, vi } from "vitest";

import {
  createServiceWorker,
  networkFirstNavigation,
} from "../scripts/service-worker.mjs";

function response(body: string): Response {
  return new Response(body);
}

describe("service-worker navigation updates", () => {
  test("uses the current network page before consulting the offline shell", async () => {
    const cache = { match: vi.fn(() => Promise.resolve(response("cached"))) };
    const request = new Request("https://chromaflow.example/?p=shared");
    const fetchRequest = vi.fn(() => Promise.resolve(response("current")));

    const result = await networkFirstNavigation(request, cache, fetchRequest);

    await expect(result.text()).resolves.toBe("current");
    expect(cache.match).not.toHaveBeenCalled();
  });

  test("falls back to the cached application shell while offline", async () => {
    const cached = response("offline");
    const cache = {
      match: vi.fn((path: string) =>
        Promise.resolve(path === "./index.html" ? cached : undefined),
      ),
    };
    const request = new Request("https://chromaflow.example/?p=shared");

    const result = await networkFirstNavigation(request, cache, () =>
      Promise.reject(new TypeError("offline")),
    );

    expect(result).toBe(cached);
    expect(cache.match).toHaveBeenCalledWith("./index.html");
  });

  test("generates a worker containing the tested navigation strategy", () => {
    const worker = createServiceWorker("version", ["./", "./index.html"]);

    expect(worker).toContain(
      "networkFirstNavigation(event.request, cache, fetch)",
    );
    expect(worker).not.toContain('cache.match("./index.html") ||');
  });
});
