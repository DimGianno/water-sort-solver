import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export async function openFourBottleBuilder(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Number of bottles").fill("4");
  await page.getByLabel("Red", { exact: true }).check();
  await page.getByLabel("Blue", { exact: true }).check();
  await expect(page.locator("#colorLimitHint")).toHaveText("2/2 selected");
  await page.getByRole("button", { name: /Build puzzle/ }).click();
  await expect(page.locator(".bottle")).toHaveCount(4);
  await expect(page.locator(".layer:disabled")).toHaveCount(0);
}

export function paletteColor(page: Page, color: string): Locator {
  return page.getByRole("button", {
    name: new RegExp(`^${color}, \\d+ remaining$`),
  });
}

export async function placeColor(
  page: Page,
  color: string,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index++) {
    const currentButton = paletteColor(page, color);
    const accessibleName = await currentButton.getAttribute("aria-label");
    const remaining = Number.parseInt(
      accessibleName?.match(/(\d+) remaining$/)?.[1] || "0",
      10,
    );
    expect(remaining).toBeGreaterThan(0);
    await currentButton.dispatchEvent("click");
    if (remaining > 1) {
      await expect(
        page.getByRole("button", {
          name: `${color}, ${remaining - 1} remaining`,
          exact: true,
        }),
      ).toBeVisible();
    } else {
      await expect(paletteColor(page, color)).toHaveCount(0);
    }
  }
}

export async function fillSolvablePuzzle(page: Page): Promise<void> {
  await placeColor(page, "Blue", 2);
  await placeColor(page, "Red", 4);
  await placeColor(page, "Blue", 2);
  await expect(page.locator("#fillPalette")).toHaveText(
    /All color pieces are placed/,
  );
  await expect(page.locator("#validationMsg")).toHaveText(
    "Input looks valid. You can solve.",
  );
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();
}
