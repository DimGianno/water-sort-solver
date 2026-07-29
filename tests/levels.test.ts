import { expect, test } from "vitest";

import { parseKnownLevels } from "../assets/js/levels.ts";

test("known-level responses are normalized, deduplicated, and sorted", () => {
  expect(
    parseKnownLevels({
      levels: [
        { level: 6, code: "WS1:six" },
        { level: 2, code: "WS1:two", updatedAt: "2026-07-29T00:00:00Z" },
        { level: 6, code: "WS1:duplicate" },
        { level: -1, code: "WS1:negative" },
        { level: 3, code: "not-a-puzzle" },
      ],
    }),
  ).toEqual([
    { level: 2, code: "WS1:two", updatedAt: "2026-07-29T00:00:00Z" },
    { level: 6, code: "WS1:six" },
  ]);
});

test("known-level responses require a levels array", () => {
  expect(() => parseKnownLevels({ message: "missing" })).toThrow(
    "Invalid known-level response.",
  );
});
