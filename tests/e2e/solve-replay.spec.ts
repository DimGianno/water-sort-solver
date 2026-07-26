import { expect, test } from "@playwright/test";

import { fillSolvablePuzzle, openFourBottleBuilder } from "./helpers.ts";

test("a sample puzzle solves and reveals replay with one click", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByLabel("Show states")).not.toBeChecked();
  await expect(page.getByLabel("Concise moves")).not.toBeChecked();
  await page.getByRole("button", { name: "Try a sample" }).click();

  await expect(page.locator("#success")).toContainText("Solved!", {
    timeout: 15_000,
  });
  await expect(page.locator("#replay")).toBeVisible();
  await expect(page.locator("#replayCard")).toBeInViewport();
  await expect(page.locator("#stepLabel")).toHaveText(/Step 0\/\d+/i);

  if (testInfo.project.name === "desktop-chromium") {
    const layout = await page.evaluate(() => {
      const controls = document.querySelector<HTMLElement>(".solve-controls");
      const success = document.querySelector<HTMLElement>("#success");
      const controlItems = [
        document.querySelector("#modeSel"),
        document.querySelector("#showStates")?.closest("label"),
        document.querySelector("#shortMoves")?.closest("label"),
        document.querySelector("#solveBtn"),
      ];
      if (!controls || !success || controlItems.some((item) => !item)) {
        throw new Error("Expected solve controls and success message");
      }
      const controlBottoms = controlItems.map((item) => {
        if (!item) throw new Error("Expected solve control");
        const box = item.getBoundingClientRect();
        return box.bottom;
      });
      const controlsBox = controls.getBoundingClientRect();
      const successBox = success.getBoundingClientRect();
      return {
        controlBottoms,
        controlsBottom: controlsBox.bottom,
        successTop: successBox.top,
      };
    });

    expect(
      Math.max(...layout.controlBottoms) - Math.min(...layout.controlBottoms),
    ).toBeLessThanOrEqual(1);
    expect(layout.successTop).toBeGreaterThanOrEqual(layout.controlsBottom);
  }
});

test("the complete solve and replay flow works through visible controls", async ({
  page,
}) => {
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
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
});
