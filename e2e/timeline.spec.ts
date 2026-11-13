import { expect, test } from "./fixtures";

// The time-scaled timeline (step 10). At the default zoom (160 px per second) and speed
// (8 pictures per second), one tick, and so a new one-tick picture, is 20 px wide.

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(3);
});

test("each picture is as wide as it lasts, and the ruler counts seconds", async ({ studio, page }) => {
  for (const number of [1, 2, 3]) expect(await studio.widthOf(studio.picture(number))).toBeCloseTo(20, 0);
  await expect(page.locator(".ruler-label").first()).toHaveText("0s");
  await expect(page.locator(".ruler-label").nth(1)).toHaveText("1s");
  // Labels sit one second (160 px) apart.
  const [zero, one] = await Promise.all([0, 1].map((i) => page.locator(".ruler-label").nth(i).boundingBox()));
  expect((one?.x ?? 0) - (zero?.x ?? 0)).toBeCloseTo(160, 0);
  await expect(page.locator(".timeline-tools .duration")).toContainText("0.4 s");   // 3 ticks at 8 fps
});

test("clicking selects a picture; arrow keys, Home and End move the selection", async ({ studio, page }) => {
  await studio.picture(2).click();
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  await expect(studio.track()).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("ArrowRight");   // already at the end: stays
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Home");
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option", { selected: true })).toHaveCount(0);
});

test("zooming changes how wide a second is, not how long pictures last", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);   // 160 × 1.5 / 8
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(13.3, 0);   // 160 / 1.5 / 8
  await expect(page.locator(".timeline-tools .duration")).toContainText("0.4 s");      // still 3 ticks long
});

test("Ctrl + mouse wheel over the timeline zooms too", async ({ studio, page }) => {
  await studio.picture(1).hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);
});

test("the thumbnails show the pictures that were taken", async ({ studio }) => {
  for (const number of [1, 2, 3]) {
    await expect.poll(() => studio.thumbnailOf(number)).toMatchObject({ type: "image/jpeg" });
  }
});
