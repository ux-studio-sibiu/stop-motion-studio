import { expect, test } from "./fixtures";

// Frame operations (step 12): captures go after the selection, several pictures can be
// selected, and duplicates are exact copies placed after their source.

test.beforeEach(async ({ studio }) => {
  await studio.open();
});

test("a capture selects itself, so the next one follows it", async ({ studio }) => {
  await studio.cameraOn();
  await studio.takePictures(2);
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  await expect(studio.selected()).toHaveCount(1);
});

test("with a picture selected, new pictures go right after it, in the order they're taken", async ({ studio, page }) => {
  await studio.cameraOn();
  await studio.takePictures(3);
  const [a, b, c] = await studio.order();

  // Picked with the keys, so the camera stays on (a click opens the Picture tab, turning it off).
  await studio.track().focus();
  await page.keyboard.press("Home");
  // The playhead marks that picture: the new ones go right after it.
  const marked = (await page.locator(".playhead").boundingBox())!;
  expect(Math.abs(marked.x - (await studio.picture(1).boundingBox())!.x)).toBeLessThan(8);
  await studio.takePictures(2);
  const now = await studio.order();
  expect(now).toHaveLength(5);
  expect([now[0], now[3], now[4]]).toEqual([a, b, c]);
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");   // the second new one
});

test("Shift+click selects a range, Ctrl+click adds or removes one; Delete removes them all, one undo brings them back", async ({ studio, page }) => {
  await studio.seedPictures(5);
  const taken = await studio.order();

  await studio.picture(2).click();
  await studio.picture(4).click({ modifiers: ["Shift"] });
  expect(await studio.selectedOrder()).toEqual(taken.slice(1, 4));
  await studio.picture(3).click({ modifiers: ["ControlOrMeta"] });
  expect(await studio.selectedOrder()).toEqual([taken[1], taken[3]]);
  await studio.picture(5).click({ modifiers: ["ControlOrMeta"] });
  await expect(studio.deleteButton()).toHaveAccessibleName("Delete 3 pictures");
  await expect(page.locator(".playhead")).toHaveCount(3);   // the playhead marks each selected picture, gaps and all

  await page.keyboard.press("Delete");
  await expect.poll(() => studio.order()).toEqual([taken[0], taken[2]]);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Delete 3 pictures");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.order()).toEqual(taken);
  expect(await studio.selectedOrder()).toEqual([taken[1], taken[3], taken[4]]);
});

test("Shift+arrows extend the selection, Ctrl+A selects everything", async ({ studio, page }) => {
  await studio.seedPictures(4);
  const taken = await studio.order();
  await studio.picture(2).click();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  expect(await studio.selectedOrder()).toEqual(taken.slice(1, 4));
  await page.keyboard.press("Shift+ArrowLeft");
  expect(await studio.selectedOrder()).toEqual(taken.slice(1, 3));
  await page.keyboard.press("ControlOrMeta+a");
  expect(await studio.selectedOrder()).toEqual(taken);
});

test("a duplicate is an exact copy, right after its source, and is selected", async ({ studio, page }) => {
  await studio.seedPictures(2);
  const [a, b] = await studio.order();
  await studio.picture(1).click();
  await studio.duplicateButton().click();

  await expect(studio.pictures()).toHaveCount(3);
  const now = await studio.order();
  expect([now[0], now[2]]).toEqual([a, b]);
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  // The same photo: the copy's thumbnail is the very same image as the source's.
  const background = (n: number) => studio.thumbPhoto(n).evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(await background(2)).toBe(await background(1));
  expect(await studio.widthOf(studio.picture(2))).toBeCloseTo(await studio.widthOf(studio.picture(1)), 1);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.order()).toEqual([a, b]);
});

test("Ctrl+D duplicates every selected picture, each after its own source", async ({ studio, page }) => {
  await studio.seedPictures(2);
  const [a, b] = await studio.order();
  await studio.picture(1).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+d");
  await expect(studio.pictures()).toHaveCount(4);
  const now = await studio.order();
  expect([now[0], now[2]]).toEqual([a, b]);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Duplicate 2 pictures");
});
