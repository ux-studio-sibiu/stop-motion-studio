import { expect, test } from "./fixtures";

// Undo and redo (step 11). Taking and deleting pictures are commands, so both can be undone.

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.cameraOn();
});

test("undo takes back the last picture, redo brings it back", async ({ studio }) => {
  await expect(studio.undoButton()).toBeDisabled();
  await studio.takePictures(2);
  const taken = await studio.order();

  await studio.undoButton().click();
  await expect(studio.pictures()).toHaveCount(1);
  await expect(studio.redoButton()).toBeEnabled();

  await studio.redoButton().click();
  await expect.poll(() => studio.order()).toEqual(taken);
  await expect(studio.redoButton()).toBeDisabled();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Take picture");
});

test("delete three pictures with the Delete key, undo three times: all back in place", async ({ studio, page }) => {
  await studio.takePictures(5);
  const taken = await studio.order();

  await studio.picture(2).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Delete");   // the next picture is selected each time
  await expect.poll(() => studio.order()).toEqual([taken[0], taken[4]]);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Delete picture");

  for (let i = 0; i < 3; i++) await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => studio.order()).toEqual(taken);
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");   // the last one restored
  await expect.poll(() => studio.thumbnailOf(3)).toMatchObject({ type: "image/jpeg" });   // photos were kept

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(studio.pictures()).toHaveCount(4);
});

test("the delete button removes the selected picture, and only works with one selected", async ({ studio }) => {
  await studio.takePictures(2);
  const taken = await studio.order();
  await expect(studio.deleteButton()).toBeDisabled();

  await studio.picture(1).click();
  await studio.deleteButton().click();
  await expect.poll(() => studio.order()).toEqual([taken[1]]);
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "true");
});

test("a new change clears redo", async ({ studio }) => {
  await studio.takePictures(2);
  await studio.undoButton().click();
  await expect(studio.redoButton()).toBeEnabled();
  await studio.takePictures(1);
  await expect(studio.redoButton()).toBeDisabled();
});

test("history is per visit: after a reload the pictures stay and there's nothing to undo", async ({ studio, page }) => {
  await studio.takePictures(2);
  await page.reload();
  await expect(studio.pictures()).toHaveCount(2);
  await expect(studio.undoButton()).toBeDisabled();
});
