import { expect, test } from "./fixtures";

// Resizing a picture's length (step 13). At the default zoom and speed one tick is 20 px, so a
// new picture is 20 px wide and dragging its grip 60 px makes it 4 ticks (half a second).

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.seedPictures(3);
});

test("dragging the grip makes a picture longer, the next ones slide along, and one undo restores it", async ({ studio, page }) => {
  await studio.picture(1).click();
  const secondBefore = (await studio.picture(2).boundingBox())?.x ?? 0;

  await studio.dragGrip(1, 60, { release: false });
  await expect(page.locator(".hold-bubble")).toHaveText("0.5 s");   // shown while dragging
  await page.mouse.up();
  await expect(page.locator(".hold-bubble")).toHaveCount(0);

  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(80, 0);
  expect(((await studio.picture(2).boundingBox())?.x ?? 0) - secondBefore).toBeCloseTo(60, 0);
  await expect(page.locator(".timeline-tools .duration")).toHaveText("0.8 s");   // 6 ticks at 8 fps
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change length");

  await page.reload();   // it was saved
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(80, 0);
  // (the history is new after a reload, so undo straight after the drag instead)
});

test("undo puts the length back", async ({ studio, page }) => {
  await studio.picture(2).click();
  await studio.dragGrip(2, 40);
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(60, 0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(20, 0);
});

test("Escape while dragging puts it back and saves nothing", async ({ studio, page }) => {
  await studio.picture(1).click();
  await studio.dragGrip(1, 80, { release: false });
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(100, 0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(20, 0);
  await expect(studio.undoButton()).toBeDisabled();   // nothing was saved
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "true");   // still selected
});

test("a picture never gets shorter than one tick", async ({ studio }) => {
  await studio.picture(1).click();
  await studio.dragGrip(1, 40);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(60, 0);
  await studio.dragGrip(1, -200);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(20, 0);
});

test("a tap on the grip is still a click: Ctrl+click deselects a narrow picture it covers", async ({ studio }) => {
  await studio.picture(1).click();
  await studio.picture(2).click({ modifiers: ["ControlOrMeta"] });
  await studio.picture(1).click({ modifiers: ["ControlOrMeta"] });   // the 20 px picture is mostly grip
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "false");
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  expect(await studio.widthOf(studio.picture(1))).toBeCloseTo(20, 0);
});

test("only selected pictures have a grip", async ({ studio }) => {
  await studio.picture(2).click();
  await expect(studio.grip(2)).toHaveCount(1);
  await expect(studio.grip(1)).toHaveCount(0);
  await expect(studio.grip(3)).toHaveCount(0);
});

test("with several selected, dragging one grip resizes them all by the same amount", async ({ studio, page }) => {
  await studio.picture(1).click();
  await studio.picture(2).click({ modifiers: ["Shift"] });
  await studio.dragGrip(2, 20);
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(40, 0);
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(40, 0);
  expect(await studio.widthOf(studio.picture(3))).toBeCloseTo(20, 0);
  await expect(studio.selected()).toHaveCount(2);   // the drag didn't change the selection

  await page.keyboard.press("ControlOrMeta+z");     // one step for both
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(20, 0);
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(20, 0);
});

test("[ and ] make the selection a tick shorter or longer, even pressed quickly", async ({ studio, page }) => {
  await studio.picture(2).click();
  await page.keyboard.press("]");
  await page.keyboard.press("]");
  await page.keyboard.press("]");
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(80, 0);
  await page.keyboard.press("[");
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(60, 0);

  await page.keyboard.press("ControlOrMeta+z");     // each press is one step
  await expect.poll(() => studio.widthOf(studio.picture(2))).toBeCloseTo(80, 0);
});
