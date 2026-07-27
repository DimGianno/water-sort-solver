import { expect, test } from "@playwright/test";

import {
  fillSolvablePuzzle,
  openFourBottleBuilder,
  paletteColor,
} from "./helpers.ts";

test("layer-first entry restores inventory when a layer is cleared", async ({
  page,
}) => {
  await openFourBottleBuilder(page);

  await paletteColor(page, "Red").click();
  await expect(
    page.getByRole("button", { name: "Bottle 1, layer 1, Red" }),
  ).toBeVisible();
  await expect(paletteColor(page, "Red")).toHaveAccessibleName(
    "Red, 3 remaining",
  );

  await page.getByRole("button", { name: "Bottle 1, layer 1, Red" }).click();
  await page.getByRole("button", { name: "Clear layer" }).click();

  await expect(
    page.getByRole("button", { name: "Bottle 1, layer 1, empty" }),
  ).toBeVisible();
  await expect(paletteColor(page, "Red")).toHaveAccessibleName(
    "Red, 4 remaining",
  );
});

test("layer-first entry reaches a valid, solvable puzzle", async ({ page }) => {
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);

  await expect(page.locator(".layer[aria-label$=', Red']")).toHaveCount(4);
  await expect(page.locator(".layer[aria-label$=', Blue']")).toHaveCount(4);
});

test("clear all bottles restores the full color inventory", async ({
  page,
}) => {
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);

  await page.getByRole("button", { name: "Clear all bottles" }).click();

  await expect(page.locator(".layer[aria-label$=', empty']")).toHaveCount(16);
  await expect(paletteColor(page, "Red")).toHaveAccessibleName(
    "Red, 4 remaining",
  );
  await expect(paletteColor(page, "Blue")).toHaveAccessibleName(
    "Blue, 4 remaining",
  );
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeDisabled();
});

test("color-first entry paints selected layers and enforces inventory", async ({
  page,
}) => {
  await openFourBottleBuilder(page);
  await page.locator("label", { hasText: "Color first" }).click();

  await paletteColor(page, "Red").click();
  await expect(paletteColor(page, "Red")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const layer of [
    "Bottle 1, layer 3, empty",
    "Bottle 1, layer 4, empty",
    "Bottle 2, layer 1, empty",
    "Bottle 2, layer 2, empty",
  ]) {
    await page.getByRole("button", { name: layer }).click();
  }
  await expect(paletteColor(page, "Red")).toHaveCount(0);

  await paletteColor(page, "Blue").click();
  for (const layer of [
    "Bottle 1, layer 1, empty",
    "Bottle 1, layer 2, empty",
    "Bottle 2, layer 3, empty",
    "Bottle 2, layer 4, empty",
  ]) {
    await page.getByRole("button", { name: layer }).click();
  }

  await expect(page.locator("#validationMsg")).toHaveText(
    "Input looks valid. You can solve.",
  );
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();
});

test("an in-progress puzzle can use partial and formerly helper bottles", async ({
  page,
}) => {
  await openFourBottleBuilder(page);
  await page.locator("label", { hasText: "Color first" }).click();

  await paletteColor(page, "Red").click();
  for (const layer of [
    "Bottle 1, layer 3, empty",
    "Bottle 1, layer 4, empty",
    "Bottle 2, layer 1, empty",
    "Bottle 2, layer 2, empty",
  ]) {
    await page.getByRole("button", { name: layer }).click();
  }

  await paletteColor(page, "Blue").click();
  for (const layer of [
    "Bottle 2, layer 3, empty",
    "Bottle 2, layer 4, empty",
    "Bottle 3, layer 3, empty",
    "Bottle 3, layer 4, empty",
  ]) {
    await page.getByRole("button", { name: layer }).click();
  }

  await expect(page.locator("#validationMsg")).toHaveText(
    "Input looks valid. You can solve.",
  );
  await page.getByRole("button", { name: /Solve puzzle/ }).click();
  await expect(page.locator("#success")).toContainText("Solved!", {
    timeout: 15_000,
  });
});
