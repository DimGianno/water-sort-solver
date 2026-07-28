import { expect, test } from "@playwright/test";

import { openFourBottleBuilder } from "./helpers.ts";

test("the empty desktop workspace fills the configure panel height", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"));

  await page.goto("/");

  const panelBounds = await page.evaluate(() => {
    const setupPanel = document.querySelector(".setup-panel");
    const solveCard = document.querySelector(".solve-card");
    if (!setupPanel || !solveCard) throw new Error("Expected workspace panels");

    return {
      setupBottom: setupPanel.getBoundingClientRect().bottom,
      solveBottom: solveCard.getBoundingClientRect().bottom,
    };
  });

  expect(
    Math.abs(panelBounds.setupBottom - panelBounds.solveBottom),
  ).toBeLessThan(1);
});

test("the workspace stays usable without page-level horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto("/");

  const initialLayout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(initialLayout.documentWidth).toBeLessThanOrEqual(
    initialLayout.viewportWidth + 1,
  );

  await openFourBottleBuilder(page);
  const builtLayout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(builtLayout.documentWidth).toBeLessThanOrEqual(
    builtLayout.viewportWidth + 1,
  );

  const paletteButtons = page.locator(".palette-color");
  const buttonCount = await paletteButtons.count();
  for (let index = 0; index < buttonCount; index++) {
    const box = await paletteButtons.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Expected palette button bounds");
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(
      builtLayout.viewportWidth + 1,
    );
  }

  if (["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name)) {
    await expect(page.locator(".workspace")).toHaveScreenshot(
      `workspace-${testInfo.project.name}.png`,
    );
  }
});

test("theme switching remains available at every configured viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
});
