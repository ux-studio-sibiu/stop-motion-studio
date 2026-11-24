import { expect, test } from "./fixtures";

// The time-scaled timeline (step 10). At the default zoom (160 px per second) and speed
// (8 pictures per second), one tick, and so a new one-tick picture, is 20 px wide.

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.seedPictures(3);
});

test("each picture is as wide as it lasts, and the ruler counts seconds", async ({ studio, page }) => {
  await studio.showGradations();
  for (const number of [1, 2, 3]) expect(await studio.widthOf(studio.picture(number))).toBeCloseTo(20, 0);
  await expect(page.locator(".ruler-label").first()).toHaveText("0s");
  await expect(page.locator(".ruler-label").nth(1)).toHaveText("1s");
  // Labels sit one second (160 px) apart.
  const [zero, one] = await Promise.all([0, 1].map((i) => page.locator(".ruler-label").nth(i).boundingBox()));
  expect((one?.x ?? 0) - (zero?.x ?? 0)).toBeCloseTo(160, 0);
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
  await expect(studio.selected()).toHaveCount(0);
});

test("clicking a picture from the Camera tab opens the Picture tab; the arrows go on through the pictures", async ({ studio, page }) => {
  const tab = (name: string) => page.getByRole("tab", { name });
  await expect(tab("Camera")).toHaveAttribute("aria-selected", "true");
  await studio.picture(1).click();
  await expect(tab("Picture")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");   // the Picture tab's arrows (nudging the picture) don't take over
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");

  // With nothing focused, the arrows still go from picture to picture.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ArrowRight");
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");

  // From the picture's other tabs, a click keeps the tab.
  await tab("Draw").click();
  await studio.picture(1).click();
  await expect(tab("Draw")).toHaveAttribute("aria-selected", "true");
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
});

test("each animation remembers its own zoom and scroll position after a reload", async ({ studio, page }) => {
  const scroller = page.locator(".timeline-scroll");
  const scrollLeft = () => scroller.evaluate((element) => element.scrollLeft);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in" }).click();   // 810 px/s: 101.25 px a picture
  await studio.seedPictures(13);   // 16 pictures, 1620 px: wider than the timeline
  await scroller.evaluate((element) => { element.scrollLeft = 300; });
  await page.waitForTimeout(400);   // the scroll is saved once it stops
  const animation = page.url();

  await page.reload();
  await expect(studio.pictures()).toHaveCount(16);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(101.25, 0);
  await expect.poll(scrollLeft).toBeCloseTo(300, -1);

  await studio.open();   // a new animation: the last zoom used, scrolled to the start
  await studio.seedPictures(1);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(101.25, 0);
  await page.getByRole("button", { name: "Zoom out" }).click();   // this one gets its own zoom
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(67.5, 0);

  await page.goto(animation);   // the first one kept its own view
  await expect(studio.pictures()).toHaveCount(16);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(101.25, 0);
  await expect.poll(scrollLeft).toBeCloseTo(300, -1);
});

test("the zoom is remembered after a reload, and in a new animation", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);
  await page.reload();
  await expect(studio.pictures()).toHaveCount(3);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(30, 0);

  await studio.open();   // a new, empty animation
  await studio.seedPictures(1);
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
  await studio.showGradations();
  await studio.picture(1).click();
  await studio.dragGrip(1, 300);   // 16 ticks: 2 s, 320 px, much wider than its thumbnail
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(320, 0);
  const thumb = await studio.widthOf(studio.thumb(1));
  expect(thumb).toBeGreaterThan(40);
  expect(thumb).toBeLessThan(250);   // once, not stretched or repeated along the picture
  expect(await studio.thumbPhoto(1).evaluate((element) => getComputedStyle(element).backgroundRepeat)).toBe("no-repeat");

  // The next picture starts exactly at 2 s on the ruler, and its visible part 10 px after the first ends.
  const [secondSlot, firstPicture, twoSeconds] = await Promise.all([studio.picture(2).boundingBox(), studio.picture(1).locator(".picture").boundingBox(), page.locator(".ruler-label").nth(2).boundingBox()]);
  expect(secondSlot!.x).toBeCloseTo(twoSeconds!.x, 0);
  expect(secondSlot!.x - (firstPicture!.x + firstPicture!.width)).toBeCloseTo(10, 0);
});

test("the thumbnails show the pictures that were taken", async ({ studio }) => {
  for (const number of [1, 2, 3]) {
    await expect.poll(() => studio.thumbnailOf(number)).toMatchObject({ type: "image/jpeg" });
  }
});

test("each animation remembers which pictures were selected", async ({ studio, page }) => {
  await studio.picture(2).click();
  await studio.picture(3).click({ modifiers: ["Shift"] });
  await page.reload();
  await expect(studio.pictures()).toHaveCount(3);
  expect(await studio.selectedOrder()).toEqual((await studio.order()).slice(1, 3));
});

test("the timeline's buttons come in four groups: minimize and layers, zoom, undo and redo, then duplicate, add photos and delete", async ({ page }) => {
  const tools = page.locator(".timeline-tools").locator("button, .tools-gap");
  const names = await tools.evaluateAll((items) => items.map((item) => (item.classList.contains("tools-gap") ? "|" : item.getAttribute("aria-label"))));
  expect(names).toEqual(["Minimize", "Timeline layers", "|", "Zoom out", "Zoom in", "|", "Undo", "Redo", "|", "Duplicate picture", "Add photos", "Delete picture"]);
});

// An empty picture (no photo): the next-picture slot adds one, see-through, shown on a checkerboard.
test("the next-picture slot adds an empty picture after the selected one, one undo step, on a checkerboard", async ({ studio, page }) => {
  const before = await studio.order();
  await studio.picture(1).click();
  await page.getByRole("button", { name: "Insert frame" }).click();
  await expect(studio.pictures()).toHaveCount(4);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add empty picture");
  const order = await studio.order();
  expect([order[0], order[2], order[3]]).toEqual(before);   // in second place, after the selected one
  await expect(studio.picture(2)).toHaveClass(/is-empty/);   // the checkerboard on the timeline...
  await page.getByRole("tab", { name: "Picture" }).click();   // the camera off, so the stage shows the picture
  await studio.picture(2).click();
  await expect(page.locator(".stage-picture")).toHaveClass(/is-empty/);   // ...and on the stage
  await expect(studio.picture(1)).not.toHaveClass(/is-empty/);

  await page.reload();   // saved, and still empty
  await expect(studio.picture(2)).toHaveClass(/is-empty/);
});

test("the ruler's gradations are off at first; the Layers menu turns them on, and that's remembered", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  const labels = page.locator(".ruler-label");
  await expect(labels).toHaveCount(0);   // no times, no marks

  await page.getByRole("button", { name: "Timeline layers" }).click();
  await page.getByRole("checkbox", { name: "Gradations" }).check();
  await expect(labels.first()).toHaveText("0s");
  await expect(page.locator(".ruler")).toHaveClass(/has-gradations/);

  await page.reload();
  await expect(labels.first()).toHaveText("0s");
});

// Minimize (the tools' first button): the pictures a third as tall, the stage taller, and zoomed
// out two steps, so they keep about their shape (Maximize zooms back in). Shown, an extra
// row makes the timeline taller, the pictures staying small. Remembered for every animation.
test("Minimize makes the pictures small, extra rows still fit, and it's remembered for every animation", async ({ studio, page }) => {
  const timeline = page.getByRole("region", { name: "Timeline" });
  const heightOf = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!.height;
  const full = await heightOf(studio.picture(1));
  const tall = await heightOf(timeline);

  await page.getByRole("button", { name: "Minimize" }).click();
  await expect(page.getByRole("button", { name: "Maximize" })).toHaveAttribute("title", "Maximize");
  await expect.poll(() => heightOf(studio.picture(1))).toBeLessThan(full * 0.45);
  const small = await heightOf(studio.picture(1));
  expect(small).toBeGreaterThan(full * 0.25);   // about a third
  expect(await studio.widthOf(studio.picture(1))).toBeCloseTo(20 / 2.25, 0);   // two zoom steps of 1.5 out
  const short = await heightOf(timeline);
  expect(short).toBeLessThan(tall);

  await page.getByRole("button", { name: "Timeline layers" }).click();
  await page.getByRole("group", { name: "Timeline layers" }).getByLabel("Objects Layer").check();
  await expect(page.getByRole("group", { name: "Objects Layer" })).toBeVisible();
  await expect.poll(() => heightOf(timeline)).toBeGreaterThan(short + 10);   // grown to fit the row
  expect(await heightOf(studio.picture(1))).toBeCloseTo(small, 0);           // the pictures as small as before

  await page.reload();
  await expect(page.getByRole("button", { name: "Maximize" })).toBeVisible();
  await studio.open();   // another, new animation: minimized too
  await expect(page.getByRole("button", { name: "Maximize" })).toBeVisible();
  await studio.seedPictures(1);
  await page.getByRole("button", { name: "Maximize" }).click();
  await expect(page.getByRole("button", { name: "Minimize" })).toBeVisible();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(20, 0);   // zoomed back in
});

// A list that opens below its button (the Layers list, over the timeline) opens above it when the
// window has no room underneath: with only the pictures showing (the timeline is too short for it),
// or minimized. With both extra rows showing there's room.
test("the Layers list opens below its button, or above it when there's no room below", async ({ page }) => {
  const button = page.getByRole("button", { name: "Timeline layers" });
  const list = page.getByRole("group", { name: "Timeline layers" });
  const where = async () => { const [menu, at] = [(await list.boundingBox())!, (await button.boundingBox())!]; return menu.y >= at.y + at.height ? "below" : menu.y + menu.height <= at.y ? "above" : "over"; };

  await button.click();
  expect(await where()).toBe("above");   // only the pictures: no room
  await list.getByLabel("Objects Layer").check();
  await list.getByLabel("Sound Layer").check();
  await button.click();   // closed
  await button.click();
  expect(await where()).toBe("below");   // the timeline taller: room
  await button.click();

  await page.getByRole("button", { name: "Minimize" }).click();
  await button.click();
  expect(await where()).toBe("above");
  expect((await list.boundingBox())!.y).toBeGreaterThanOrEqual(0);   // inside the window
});
