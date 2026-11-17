import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Free drawing (step 24b), in the Draw tab with the camera off: drawing lines on the picture, the
// eraser, clearing, the settings remembered, and the drawing as one object in the Objects tab.

test.beforeEach(async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  await studio.picture(2).click();
  await page.getByRole("tab", { name: "Draw" }).click();
});

const RED = [214, 40, 40];   // the pencil's first colour
const layer = (page: Page) => page.getByRole("application", { name: /^(Drawing|Eraser):/ });


test("a line drawn on the picture shows on the stage and its thumbnail; each line is one undo step", async ({ studio, page }) => {
  await studio.dragOnStage(layer(page), [0.2, 0.3], [0.8, 0.3]);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Draw");
  await expect.poll(() => studio.stageColour(0.5, 0.3)).toEqual(RED);
  const thumb = studio.thumbObjects(2);
  await expect.poll(() => thumb.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(canvas.width / 2, Math.round(canvas.height * 0.3), 1, 1).data[3])).toBeGreaterThan(0);

  await studio.dragOnStage(layer(page), [0.2, 0.7], [0.8, 0.7]);
  await expect.poll(() => studio.stageColour(0.5, 0.7)).toEqual(RED);
  await studio.undoButton().click();   // only the second line goes
  await expect.poll(() => studio.stageColour(0.5, 0.7)).not.toEqual(RED);
  await expect.poll(() => studio.stageColour(0.5, 0.3)).toEqual(RED);
});

test("the eraser rubs out the lines it touches; Clear drawing takes the rest; each is one undo step", async ({ studio, page }) => {
  await studio.dragOnStage(layer(page), [0.2, 0.3], [0.8, 0.3]);
  await studio.dragOnStage(layer(page), [0.2, 0.7], [0.8, 0.7]);
  await page.getByRole("button", { name: "Eraser" }).click();
  await studio.dragOnStage(layer(page), [0.5, 0.15], [0.5, 0.45]);   // across the top line only
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Erase");
  await expect.poll(() => studio.stageColour(0.3, 0.3)).not.toEqual(RED);   // all of it, not just where it was rubbed
  await expect.poll(() => studio.stageColour(0.3, 0.7)).toEqual(RED);

  await page.getByRole("button", { name: "Clear drawing" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Clear drawing");
  await expect.poll(() => studio.stageColour(0.3, 0.7)).not.toEqual(RED);
  await expect(page.getByRole("button", { name: "Clear drawing" })).toBeDisabled();
});

test("the tool, colour and width are remembered after a reload; a colour takes the pencil again", async ({ page }) => {
  await page.getByRole("button", { name: "Blue" }).click();
  await page.getByRole("button", { name: "Huge" }).click();
  await page.getByRole("button", { name: "Eraser" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Draw" }).click();
  await expect(page.getByRole("button", { name: "Eraser" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Huge" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Green" }).click();
  await expect(page.getByRole("button", { name: "Pencil" })).toHaveAttribute("aria-pressed", "true");
});

test("a picture's drawing is one object in the Objects tab", async ({ studio, page }) => {
  await studio.dragOnStage(layer(page), [0.2, 0.3], [0.8, 0.3]);
  await studio.dragOnStage(layer(page), [0.2, 0.7], [0.8, 0.7]);
  await page.getByRole("tab", { name: "Objects" }).click();
  const box = (await page.getByRole("application", { name: /^Objects/ }).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);   // between the lines: inside the drawing's box
  await expect(page.getByRole("region", { name: "drawing settings" })).toBeVisible();
  await page.getByRole("region", { name: "drawing settings" }).getByRole("button", { name: "Delete drawing" }).click();
  await expect.poll(() => studio.stageColour(0.5, 0.3)).not.toEqual(RED);
  await expect.poll(() => studio.stageColour(0.5, 0.7)).not.toEqual(RED);   // both lines: one object
});

test("Ctrl+C copies the picture's drawing; Ctrl+V puts it on another, joining a drawing already there", async ({ studio, page }) => {
  await studio.dragOnStage(layer(page), [0.2, 0.3], [0.8, 0.3]);
  await page.keyboard.press("ControlOrMeta+c");
  await studio.picture(1).click();
  await studio.dragOnStage(layer(page), [0.2, 0.7], [0.8, 0.7]);   // picture 1's own line
  await page.keyboard.press("ControlOrMeta+v");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Paste drawing");
  await expect.poll(() => studio.stageColour(0.5, 0.3)).toEqual(RED);   // the pasted line, where it was
  await expect.poll(() => studio.stageColour(0.5, 0.7)).toEqual(RED);   // and its own

  await page.getByRole("button", { name: "Clear drawing" }).click();   // one drawing: both lines go
  await expect.poll(() => studio.stageColour(0.5, 0.3)).not.toEqual(RED);
  await expect.poll(() => studio.stageColour(0.5, 0.7)).not.toEqual(RED);
});
