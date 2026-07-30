import { expect, test } from "@playwright/test";

import { fillSolvablePuzzle, openFourBottleBuilder } from "./helpers.ts";

declare global {
  interface Window {
    __copiedPuzzle?: string;
  }
}

test("a compact puzzle exported through the UI can be reset and imported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(value: string) {
          window.__copiedPuzzle = value;
          return Promise.resolve();
        },
      },
    });
  });
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);

  await page.getByRole("button", { name: /Export puzzle/ }).click();
  const code = await page.getByLabel("Puzzle code").inputValue();
  expect(code).toMatch(/^WS1:/);
  const binary = atob(code.slice(4));
  expect(binary).toHaveLength(9);
  expect(binary.charCodeAt(0)).toBe(0x14);
  await expect(page.locator("#toast")).toHaveText("Puzzle copied to clipboard");
  await expect(page.locator("#toast")).toBeVisible();
  expect(await page.evaluate(() => window.__copiedPuzzle)).toBe(code);

  await page.reload();
  await expect(page.locator(".bottle")).toHaveCount(0);
  await page.getByRole("button", { name: /Import a saved puzzle/ }).click();
  await page.getByLabel("Puzzle code").fill(code);
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.locator("#ioMsg")).toHaveText("Imported successfully.");
  await expect(page.locator(".bottle")).toHaveCount(4);
  await expect(page.locator(".layer[aria-label$=', Red']")).toHaveCount(4);
  await expect(page.locator(".layer[aria-label$=', Blue']")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();
});

test("a compact saved-puzzle code fills the builder in top-to-bottom order", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Import a saved puzzle/ }).click();
  await page.getByLabel("Puzzle code").fill("WS1:FAAYGBgAGAAA");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.locator("#ioMsg")).toHaveText("Imported successfully.");
  await expect(page.locator(".bottle")).toHaveCount(4);
  await expect(
    page.getByRole("button", {
      name: "Bottle 1, layer 1, empty",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Bottle 1, layer 2, empty",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Bottle 1, layer 3, Red",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Bottle 1, layer 4, Blue",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();
});

test("a shared puzzle URL restores the builder and rejects invalid links safely", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(value: string) {
          (window as Window & { __copiedPuzzle?: string }).__copiedPuzzle =
            value;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/");
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);
  await page.getByRole("button", { name: /Share puzzle/ }).click();

  const shareUrl = await page.getByLabel("Share URL").inputValue();
  expect(new URL(shareUrl).searchParams.get("p")).toMatch(/^[A-Za-z0-9_-]+$/);

  await page.goto(shareUrl);
  await expect(page.locator("#success")).toHaveText(
    "Shared puzzle loaded. Review it, then solve.",
  );
  await expect(page.locator(".bottle")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();

  await page.goto("/?p=not!safe");
  await expect(page.locator("#error")).toHaveText(
    "Invalid shared puzzle link: Invalid shared puzzle payload.",
  );
  await expect(page.locator(".bottle")).toHaveCount(0);
});
