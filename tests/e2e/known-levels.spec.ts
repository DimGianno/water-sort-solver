import { expect, test } from "@playwright/test";

const LEVEL_SIX_CODE = "WS1:GRdxI4mCuzl5iTcbshOCAAAAAA==";

test("a known MongoDB level can be selected and imported for solving", async ({
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

  const levelPicker = page.getByLabel("Known level");
  await expect(levelPicker).toBeEnabled();
  await expect(levelPicker.locator("option")).toHaveText([
    "Choose a level",
    "Level 6",
  ]);
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "1 known level available.",
  );

  await levelPicker.selectOption("6");
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

  await expect(page.getByLabel("Known level")).toBeDisabled();
  await expect(page.locator("#knownLevelStatus")).toHaveText(
    "Known levels are unavailable. Manual and saved-code imports still work.",
  );
  await expect(page.getByLabel("Number of bottles")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /Import a saved puzzle/ }),
  ).toBeEnabled();
});
