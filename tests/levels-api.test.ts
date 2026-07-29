import { Binary } from "mongodb";
import { describe, expect, test, vi } from "vitest";

import { createLevelsHandler, formatLevelDocuments } from "../api/levels.ts";

const LEVEL_SIX_BASE64 = "GRdxI4mCuzl5iTcbshOCAAAAAA==";

describe("MongoDB known-level documents", () => {
  test("converts the stored binary puzzle to the existing WS1 code", () => {
    const updatedAt = new Date("2026-07-29T11:27:15.990Z");

    expect(
      formatLevelDocuments([
        {
          level: 6,
          puzzle: Binary.createFromBase64(LEVEL_SIX_BASE64),
          solvable: true,
          updated_at: updatedAt,
        },
      ]),
    ).toEqual([
      {
        level: 6,
        code: `WS1:${LEVEL_SIX_BASE64}`,
        updatedAt: updatedAt.toISOString(),
      },
    ]);
  });

  test("sorts levels and omits unsolvable, duplicate, or malformed records", () => {
    const validPuzzle = Binary.createFromBase64(LEVEL_SIX_BASE64);
    const invalidPuzzle = Binary.createFromBase64("AQID");

    expect(
      formatLevelDocuments([
        { level: 8, puzzle: validPuzzle, solvable: false },
        { level: 9, puzzle: invalidPuzzle, solvable: true },
        { level: 6, puzzle: validPuzzle, solvable: true },
        { level: 2, puzzle: validPuzzle, solvable: true },
        { level: 6, puzzle: validPuzzle, solvable: true },
      ]),
    ).toEqual([
      { level: 2, code: `WS1:${LEVEL_SIX_BASE64}` },
      { level: 6, code: `WS1:${LEVEL_SIX_BASE64}` },
    ]);
  });
});

describe("known-level API handler", () => {
  test("returns a cacheable level catalog for GET requests", async () => {
    const levels = [{ level: 6, code: `WS1:${LEVEL_SIX_BASE64}` }];
    const response = await createLevelsHandler(() =>
      Promise.resolve(levels),
    ).fetch(new Request("https://example.test/api/levels"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    await expect(response.json()).resolves.toEqual({ levels });
  });

  test("rejects non-GET methods without querying MongoDB", async () => {
    const loadLevels = vi.fn();
    const response = await createLevelsHandler(loadLevels).fetch(
      new Request("https://example.test/api/levels", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(loadLevels).not.toHaveBeenCalled();
  });

  test("returns a safe temporary-unavailable response on database errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await createLevelsHandler(() =>
      Promise.reject(new Error("connection details")),
    ).fetch(new Request("https://example.test/api/levels"));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Known levels are temporarily unavailable.",
    });
    consoleError.mockRestore();
  });
});
