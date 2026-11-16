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

test("the previous and next buttons step through the pictures, round past either end", async ({ studio, page }) => {
  const next = page.getByRole("button", { name: "Next picture" });
  const previous = page.getByRole("button", { name: "Previous picture" });
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");   // the last capture
  await next.click();
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "true");   // round to the start
  await next.click();
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  await previous.click();
  await previous.click();
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");   // round to the end
  await expect(studio.selected()).toHaveCount(1);
});

test("the timeline takes focus for the keys but never shows a focus ring", async ({ studio, page }) => {
  const outline = () => studio.track().evaluate((element) => getComputedStyle(element).outlineStyle);
  await studio.picture(2).click();
  await expect(studio.track()).toBeFocused();   // the keys still work straight away
  expect(await outline()).toBe("none");
  await page.keyboard.press("ArrowRight");
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");
  expect(await outline()).toBe("none");
});

test("zooming changes how wide a second is, not how long pictures last", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);   // 160 × 1.5 / 8
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(13.3, 0);   // 160 / 1.5 / 8
  await expect(page.locator(".timeline-tools .duration")).toContainText("0.4 s");      // still 3 ticks long
});

test("each animation remembers its own zoom and scroll position after a reload", async ({ studio, page }) => {
  const scroller = page.locator(".timeline-scroll");
  const scrollLeft = () => scroller.evaluate((element) => element.scrollLeft);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in" }).click();   // 640 px/s: 80 px a picture
  await studio.takePictures(13);   // 16 pictures, 1280 px: wider than the timeline
  await scroller.evaluate((element) => { element.scrollLeft = 300; });
  await page.waitForTimeout(400);   // the scroll is saved once it stops
  const animation = page.url();

  await page.reload();
  await expect(studio.pictures()).toHaveCount(16);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(80, 0);
  await expect.poll(scrollLeft).toBeCloseTo(300, -1);

  await studio.open();   // a new animation: the last zoom used, scrolled to the start
  await studio.cameraOn();
  await studio.takePictures(1);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(80, 0);
  await page.getByRole("button", { name: "Zoom out" }).click();   // this one gets its own zoom
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(53.3, 0);

  await page.goto(animation);   // the first one kept its own view
  await expect(studio.pictures()).toHaveCount(16);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(80, 0);
  await expect.poll(scrollLeft).toBeCloseTo(300, -1);
});

test("the zoom is remembered after a reload, and in a new animation", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);
  await page.reload();
  await expect(studio.pictures()).toHaveCount(3);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);

  await studio.open();   // a new, empty animation
  await studio.cameraOn();
  await studio.takePictures(1);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);
});

test("Ctrl + mouse wheel over the timeline zooms too", async ({ studio, page }) => {
  await studio.picture(1).hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);
});

test("a long picture shows its thumbnail once and a gap before the next, still on time", async ({ studio, page }) => {
  await studio.picture(1).click();
  await studio.dragGrip(1, 300);   // 16 ticks: 2 s, 320 px, much wider than its thumbnail
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(320, 0);
  const thumb = await studio.widthOf(studio.thumb(1));
  expect(thumb).toBeGreaterThan(40);
  expect(thumb).toBeLessThan(250);   // once, not stretched or repeated along the picture
  expect(await studio.thumb(1).evaluate((element) => getComputedStyle(element).backgroundRepeat)).not.toContain("repeat-x");

  // The next picture starts exactly at 2 s on the ruler, and its visible part 5 px after the first ends.
  const [secondSlot, firstPicture, twoSeconds] = await Promise.all([studio.picture(2).boundingBox(), studio.picture(1).locator(".picture").boundingBox(), page.locator(".ruler-label").nth(2).boundingBox()]);
  expect(secondSlot!.x).toBeCloseTo(twoSeconds!.x, 0);
  expect(secondSlot!.x - (firstPicture!.x + firstPicture!.width)).toBeCloseTo(5, 0);
});

test("the thumbnails show the pictures that were taken", async ({ studio }) => {
  for (const number of [1, 2, 3]) {
    await expect.poll(() => studio.thumbnailOf(number)).toMatchObject({ type: "image/jpeg" });
  }
});
