import { expect, test } from "@playwright/test";

const LEVEL_SIX_CODE = "WS1:GRdxI4mCuzl5iTcbshOCAAAAAA==";

test("a known MongoDB level can be searched and imported for solving", async ({
  page,
}) => {
  await page.route("**/api/levels", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        levels: [
          {
            level: 6,
            code: LEVEL_SIX_CODE,
            updatedAt: "2026-07-29T11:27:15.990Z",
          },
        ],
      }),
    });
  });

  await page.goto("/");

  const levelPicker = page.getByRole("searchbox", {
    name: "Known level",
    exact: true,
  });
  await expect(levelPicker).toBeEnabled();
  await expect(levelPicker).toHaveAttribute("placeholder", "Level number");
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "1 known level available.",
  );

  await levelPicker.fill("6");
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "Level 6 is ready to import.",
  );
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "Level 6 imported. Review it, then solve.",
  );
  await expect(page.locator("#success")).toHaveText(
    "Level 6 imported successfully.",
  );
  await expect(page.locator(".bottle")).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: /Solve puzzle/ }),
  ).toBeEnabled();
});

test("the known-level browser filters and paginates the in-memory catalog", async ({
  page,
}) => {
  await page.route("**/api/levels", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        levels: Array.from({ length: 55 }, (_, index) => ({
          level: index + 1,
          code: LEVEL_SIX_CODE,
        })),
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Browse all levels" }).click();

  const dialog = page.getByRole("dialog", { name: "Browse known levels" });
  await expect(dialog).toBeVisible();
  const dialogBounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!dialogBounds || !viewport) throw new Error("Expected dialog bounds");
  expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(
    viewport.width + 1,
  );
  expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(
    viewport.height + 1,
  );
  await expect(page.locator("#knownLevelResultCount")).toHaveText(
    "Showing 1-50 of 55 levels.",
  );
  await expect(dialog.locator(".known-level-result")).toHaveCount(50);

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#knownLevelResultCount")).toHaveText(
    "Showing 51-55 of 55 levels.",
  );
  await expect(dialog.locator(".known-level-result")).toHaveCount(5);

  await dialog.getByLabel("Search by level number").fill("42");
  await expect(page.locator("#knownLevelResultCount")).toHaveText(
    "Showing 1-1 of 1 level.",
  );
  await dialog.getByRole("button", { name: "Level 42" }).click();

  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Known level", exact: true }),
  ).toHaveValue("42");
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "Level 42 is ready to import.",
  );
});

test("an unavailable level library leaves existing setup flows usable", async ({
  page,
}) => {
  await page.route("**/api/levels", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: JSON.stringify({
        error: "Known levels are temporarily unavailable.",
      }),
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("searchbox", { name: "Known level", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Browse all levels" }),
  ).toBeDisabled();
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "Known levels are unavailable. Manual and saved-code imports still work.",
  );
  await expect(page.getByLabel("Number of bottles")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /Import a saved puzzle/ }),
  ).toBeEnabled();
});
