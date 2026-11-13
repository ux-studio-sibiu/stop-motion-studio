import { expect, test } from "./fixtures";

// Reordering by dragging (step 14). At the default zoom each new picture's slot is 20 px, so
// a drag of 60 px from the left edge of picture 1 drops it past the middle of picture 3.

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(4);
});

test("dragging a picture puts it somewhere else; it's saved, and one undo puts it back", async ({ studio, page }) => {
  const [a, b, c, d] = await studio.order();
  await studio.dragPicture(1, 52);
  await expect.poll(() => studio.order()).toEqual([b, c, a, d]);
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");   // the moved picture
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move picture");

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.order()).toEqual([a, b, c, d]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.reload();
  await expect.poll(() => studio.order()).toEqual([b, c, a, d]);
});

test("while dragging, a marker shows where it lands and a small copy follows the pointer", async ({ studio, page }) => {
  await studio.dragPicture(4, -70, { release: false });
  await expect(page.locator(".drop-marker")).toHaveCount(1);
  await expect(page.locator(".drag-ghost")).toBeVisible();
  await expect(studio.picture(4)).toHaveClass(/is-dragging/);
  await page.mouse.up();
  await expect(page.locator(".drop-marker")).toHaveCount(0);
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
});

test("a press without moving, or moving only a little, is still a click", async ({ studio, page }) => {
  const before = await studio.order();
  await studio.dragPicture(2, 5);   // under the 8 px it takes to start a drag
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  expect(await studio.order()).toEqual(before);
});

test("dragging a selected picture moves the whole selection together", async ({ studio, page }) => {
  const [a, b, c, d] = await studio.order();
  await studio.picture(1).click();
  await studio.picture(2).click({ modifiers: ["Shift"] });
  await studio.dragPicture(1, 75, { release: false });   // past the middle of picture 4
  await expect(page.locator(".drag-count")).toHaveText("2");
  await page.mouse.up();
  await expect.poll(() => studio.order()).toEqual([c, d, a, b]);
  expect(await studio.selectedOrder()).toEqual([a, b]);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move 2 pictures");
});

test("Escape while dragging cancels: nothing moves and nothing is saved", async ({ studio, page }) => {
  const before = await studio.order();
  await studio.dragPicture(1, 60, { release: false });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  expect(await studio.order()).toEqual(before);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Take picture");
});

test("dragging the grip resizes and never reorders", async ({ studio }) => {
  const before = await studio.order();
  await studio.picture(2).click();
  await studio.dragGrip(2, 60);
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(80, 0);
  expect(await studio.order()).toEqual(before);
});

test("Ctrl+arrows move the selected pictures one place", async ({ studio, page }) => {
  const [a, b, c, d] = await studio.order();
  await studio.picture(2).click();
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await expect.poll(() => studio.order()).toEqual([a, c, b, d]);
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await expect.poll(() => studio.order()).toEqual([a, c, d, b]);
  await page.keyboard.press("ControlOrMeta+ArrowRight");   // already last: stays, nothing recorded
  await page.keyboard.press("ControlOrMeta+ArrowLeft");
  await expect.poll(() => studio.order()).toEqual([a, c, b, d]);
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");   // the selection travels along

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.order()).toEqual([a, c, d, b]);
});

test("dragging near the timeline's edge scrolls it", async ({ studio, page }) => {
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in" }).click();   // 640 px/s: 80 px a picture
  await studio.takePictures(12);   // 16 × 80 px: wider than the timeline
  const scroller = page.locator(".timeline-scroll");
  await scroller.evaluate((element) => { element.scrollLeft = 0; });
  await expect.poll(() => scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const box = (await scroller.boundingBox())!;
  const picture = (await studio.picture(1).boundingBox())!;
  await page.mouse.move(picture.x + 10, picture.y + picture.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 10, picture.y + picture.height / 2, { steps: 10 });
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  await page.keyboard.press("Escape");
  await page.mouse.up();
});
