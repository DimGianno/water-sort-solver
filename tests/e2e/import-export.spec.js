import { expect, test } from "@playwright/test";

import { fillSolvablePuzzle, openFourBottleBuilder } from "./helpers.js";

test("a puzzle exported through the UI can be reset and imported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(value) {
          window.__copiedPuzzle = value;
        },
      },
    });
  });
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);

  await page.getByRole("button", { name: /Export puzzle/ }).click();
  const code = await page.getByLabel("Puzzle code").inputValue();
  expect(code).toMatch(/^WS1:/);
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
