import { expect, test } from "@playwright/test";

import { fillSolvablePuzzle, openFourBottleBuilder } from "./helpers.js";

test("the complete solve and replay flow works through visible controls", async ({ page }) => {
  await openFourBottleBuilder(page);
  await fillSolvablePuzzle(page);
  await page.getByRole("button", { name: /Solve puzzle/ }).click();

  await expect(page.locator("#success")).toContainText("Solved!");
  await expect(page.locator("#replay")).toBeVisible();
  await expect(page.locator("#stepLabel")).toHaveText(/Step 0\/\d+/i);
  await expect(page.getByRole("button", { name: /Previous/ })).toBeDisabled();

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator("#stepLabel")).toHaveText(/Step 1\/\d+/i);
  await expect(page.getByRole("button", { name: /Previous/ })).toBeEnabled();

  await page.getByLabel("Speed").fill("4");
  await expect(page.locator("#speedLabel")).toHaveText("4x");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
});
