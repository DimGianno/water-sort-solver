import { expect, test } from "@playwright/test";

const LAYERS = [
  ["Purple", "Purple", "Purple", "Light Green"],
  ["Green", "Green", "Green", "Green"],
  ["Blue", "Blue", "Purple", "Blue"],
  ["Orange", "Orange", "Orange", "Orange"],
  ["", "Gray", "Gray", "Gray"],
  ["", "Red", "Red", "Red"],
  ["", "Light Green", "Light Green", "Red"],
  ["", "", "Blue", "Gray"],
  ["", "", "", "Light Green"],
  ["Light Blue", "Light Blue", "Light Blue", "Light Blue"],
  ["Pink", "Pink", "Pink", "Pink"],
];

const RGB: Record<string, string> = {
  Red: "rgb(181, 57, 45)",
  Pink: "rgb(219, 103, 124)",
  Orange: "rgb(219, 144, 81)",
  Green: "rgb(127, 149, 48)",
  "Light Green": "rgb(129, 212, 134)",
  Blue: "rgb(56, 47, 188)",
  "Light Blue": "rgb(103, 161, 224)",
  Purple: "rgb(105, 48, 143)",
  Gray: "rgb(100, 100, 102)",
};

function syntheticScreenshotMarkup(): string {
  const positions = [
    ...[18, 95, 173, 250, 327, 404].map((x) => [x, 309]),
    ...[31, 121, 211, 301, 391].map((x) => [x, 611]),
  ];
  const fractions = [0.25, 0.455, 0.66, 0.865];
  const bottles = positions
    .map(([x, y], bottle) => {
      const liquid = LAYERS[bottle]
        .map((color, layer) =>
          color
            ? `<i style="top:${Math.round(211 * fractions[layer] - 20)}px;background:${RGB[color]}"></i>`
            : "",
        )
        .join("");
      return `<div class="tube" style="left:${x}px;top:${y}px">${liquid}</div>`;
    })
    .join("");

  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    * { box-sizing: border-box; }
    html, body { width: 480px; height: 1042px; margin: 0; overflow: hidden; background: rgb(15, 6, 18); }
    .tube { position: absolute; width: 58px; height: 211px; border: 4px solid rgb(202, 202, 202); }
    .tube i { position: absolute; left: 0; right: 0; height: 40px; }
  </style>${bottles}`;
}

test("a screenshot is recognized locally and applied to the editable builder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 1042 });
  await page.setContent(syntheticScreenshotMarkup());
  const screenshot = await page.screenshot({ type: "png" });

  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Import from a screenshot" }),
  ).toBeVisible();
  await page.locator("#screenshotInput").setInputFiles({
    name: "water-sort-level.png",
    mimeType: "image/png",
    buffer: screenshot,
  });

  await expect(page.locator("#screenshotMsg")).toHaveText(
    "Detected 11 bottles and 9 colors. Apply the result, then review every layer.",
  );
  await expect(page.locator("#screenshotApplyBtn")).toBeEnabled();
  await page.locator("#screenshotApplyBtn").click();

  await expect(page.locator("#numBottles")).toHaveValue("11");
  await expect(page.locator(".bottle")).toHaveCount(11);
  await expect(
    page.getByRole("button", {
      name: "Bottle 1, layer 1, Purple",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Bottle 9, layer 4, Light Green",
    }),
  ).toBeVisible();
  await expect(page.locator("#validationMsg")).toHaveText(
    "Input looks valid. You can solve.",
  );
  await expect(page.locator("#solveBtn")).toBeEnabled();
});
