import { expect, test } from "vitest";

import { filterKnownLevels, parseKnownLevels } from "../assets/js/levels.ts";

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

test("known levels can be filtered locally by a level-number prefix", () => {
  const levels = [
    { level: 12, code: "WS1:twelve" },
    { level: 1205, code: "WS1:twelve-oh-five" },
    { level: 2120, code: "WS1:twenty-one-twenty" },
  ];

  expect(filterKnownLevels(levels, "12")).toEqual(levels.slice(0, 2));
  expect(filterKnownLevels(levels, "Level 1,205")).toEqual([levels[1]]);
  expect(filterKnownLevels(levels, "unknown")).toEqual([]);
  expect(filterKnownLevels(levels, "")).toEqual(levels);
});
