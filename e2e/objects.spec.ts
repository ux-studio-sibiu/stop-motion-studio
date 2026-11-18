import type { Page } from "@playwright/test";
import { expect, test, type Studio } from "./fixtures";

// Objects on pictures (step 23), in the Objects tab with the camera off: dragging a speech bubble
// onto the picture (or clicking it), typing its text and choosing its settings in the panel by it, moving, sizing and deleting it on the
// stage, and objects staying with their picture when it's moved or copied.

test.beforeEach(async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(3);
  await studio.picture(2).click();
  await page.getByRole("tab", { name: "Objects" }).click();
});

const text = (page: Page) => page.getByRole("textbox", { name: "Text", exact: true });
const editor = (page: Page) => page.getByRole("application", { name: /^Objects/ });
// Whether a picture has objects: its thumbnail draws them (a canvas, only when it has some).
const objectsOn = (page: Page, number: number) => page.getByRole("option", { name: `Picture ${number}`, exact: true }).locator(".thumb canvas.objects");

// A point of the stage, as fractions of it, in page pixels.
const onStage = async (page: Page, x: number, y: number) => { const box = (await editor(page).boundingBox())!; return { x: box.x + box.width * x, y: box.y + box.height * y }; };

const tile = (page: Page) => page.getByRole("button", { name: "Speech bubble", exact: true });

async function addBubble(page: Page, studio: Studio, typed?: string) {
  await tile(page).click();   // a click puts it near the top
  await expect(text(page)).toBeFocused();   // typing straight away
  if (typed) {
    await page.keyboard.type(typed);
    await text(page).blur();   // done: saved now
    await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change bubble text");
  } else {
    await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add speech bubble");
  }
}

test("a new bubble's text is typed in its settings, drawn on the picture, and kept after a reload", async ({ studio, page }) => {
  await addBubble(page, studio, "Hello!");
  await expect.poll(() => studio.stageColour(0.33, 0.2)).toEqual([255, 255, 255]);   // the white bubble, drawn on the picture
  await expect(objectsOn(page, 2)).toHaveCount(1);
  await expect(objectsOn(page, 1)).toHaveCount(0);

  await page.reload();
  await studio.picture(2).click();
  await expect(text(page)).toHaveCount(0);      // nothing picked
  const middle = await onStage(page, 0.5, 0.2);
  await page.mouse.click(middle.x, middle.y);   // pick it
  await expect(text(page)).toHaveValue("Hello!");
  await editor(page).press("Enter");            // Enter goes to its text
  await expect(text(page)).toBeFocused();
});

test("a bubble dragged onto the picture lands where it's dropped; dropped elsewhere, nothing is added", async ({ studio, page }) => {
  const from = (await tile(page).boundingBox())!;
  const drop = async (to: { x: number; y: number }) => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  };
  await drop({ x: from.x - 30, y: from.y + 400 });   // the panel, below the tiles: not the picture
  await expect(studio.undoButton()).toBeDisabled();

  await drop(await onStage(page, 0.3, 0.7));
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add speech bubble");
  await expect(text(page)).toBeFocused();   // typing straight away
  await expect.poll(() => studio.stageColour(0.3, 0.7)).toEqual([255, 255, 255]);   // centred where it was dropped
  await expect.poll(() => studio.stageColour(0.5, 0.2)).not.toEqual([255, 255, 255]);   // not at the top
});

test("the thumbnail shows the bubble, and follows it while it's dragged", async ({ studio, page }) => {
  // Whether the thumbnail's objects canvas has paint at a point, as fractions of the picture.
  const painted = (x: number, y: number) => studio.thumbObjects(2).evaluate((canvas: HTMLCanvasElement, at) => canvas.getContext("2d")!.getImageData(Math.round(canvas.width * at.x), Math.round(canvas.height * at.y), 1, 1).data[3] > 0, { x, y });
  await expect(studio.thumbObjects(2)).toHaveCount(0);
  await addBubble(page, studio);
  await expect.poll(() => painted(0.5, 0.2)).toBe(true);   // near the top, like on the stage
  await expect.poll(() => painted(0.5, 0.75)).toBe(false);

  const middle = await onStage(page, 0.5, 0.2);
  const lower = await onStage(page, 0.5, 0.75);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(lower.x, lower.y, { steps: 8 });
  await expect.poll(() => painted(0.5, 0.75)).toBe(true);   // before letting go
  await page.mouse.up();
  await expect.poll(() => painted(0.5, 0.2)).toBe(false);
});

test("drag moves a bubble, a corner sizes it, Delete removes it; each is one undo step", async ({ studio, page }) => {
  await addBubble(page, studio);
  const middle = await onStage(page, 0.5, 0.2);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 80, middle.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move speech bubble");

  const corner = page.locator(".handles .corner.is-se");
  const at = (await corner.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Size speech bubble");

  await editor(page).press("Delete");
  await expect(objectsOn(page, 2)).toHaveCount(0);
  await studio.undoButton().click();
  await expect(objectsOn(page, 2)).toHaveCount(1);
});

test("a bubble stays with its picture when the picture moves, and a copy gets one too", async ({ studio, page }) => {
  await studio.picture(3).click();
  await addBubble(page, studio, "Me!");
  await studio.picture(3).click();
  await page.keyboard.press("ControlOrMeta+ArrowLeft");
  await page.keyboard.press("ControlOrMeta+ArrowLeft");   // picture 3 is now the first
  await expect(objectsOn(page, 1)).toHaveCount(1);
  await expect(objectsOn(page, 3)).toHaveCount(0);

  await studio.picture(1).click();
  await studio.duplicateButton().click();
  await expect(objectsOn(page, 2)).toHaveCount(1);   // the copy, right after it
});

test("shape, tail, outline, text size, font and colours are set in its settings, each one undo step", async ({ studio, page }) => {
  await addBubble(page, studio);
  await page.getByRole("combobox", { name: "Shape" }).selectOption("spiked");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change bubble shape");
  await expect(page.locator(".handles .tail")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Tail" }).uncheck();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Hide bubble tail");
  await expect(page.locator(".handles .tail")).toHaveCount(0);   // no tail, nothing to drag
  await page.getByRole("slider", { name: "Outline" }).fill("3");   // thick
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change outline");
  await page.getByRole("group", { name: "Outline colour" }).getByRole("button", { name: "Blue" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change outline colour");
  await page.getByRole("slider", { name: "Outline" }).fill("0");   // none
  await expect(page.getByRole("group", { name: "Outline colour" })).toHaveCount(0);   // nothing to colour
  await page.getByRole("combobox", { name: "Text size" }).selectOption("huge");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change text size");
  await page.getByRole("combobox", { name: "Font" }).selectOption("comic");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change font");
  await page.getByRole("group", { name: "Text colour" }).getByRole("button", { name: "Red" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change text colour");

  const black = page.getByRole("group", { name: "Bubble colour" }).getByRole("button", { name: "Black" });
  await black.click();
  await expect(black).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => studio.stageColour(0.5, 0.2)).toEqual([31, 36, 51]);   // the bubble, now black
  await studio.undoButton().click();
  await expect.poll(() => studio.stageColour(0.5, 0.2)).toEqual([255, 255, 255]);
  await expect(page.getByRole("combobox", { name: "Shape" })).toHaveValue("spiked");   // only the colour was undone

  // Any other colour, from the colour picker at the end of the row: one undo step, shown on its swatch.
  const other = page.getByRole("group", { name: "Bubble colour" }).getByLabel("Another colour");
  await other.fill("#ff8800");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change bubble colour");
  await expect.poll(() => studio.stageColour(0.5, 0.2)).toEqual([255, 136, 0]);
  await expect(page.locator(".swatch.is-custom.is-on")).toHaveCount(1);
  await expect(black).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Delete spiked bubble" }).click();
  await expect(objectsOn(page, 2)).toHaveCount(0);
});

test("text and shapes: added from their icons, set in their settings, each one undo step", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(text(page)).toBeFocused();   // typing straight away
  await page.keyboard.type("THE END");
  await text(page).blur();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change text");
  await page.getByRole("group", { name: "Background colour" }).getByRole("button", { name: "Black" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change background");
  await expect.poll(() => studio.stageColour(0.22, 0.45)).toEqual([31, 36, 51]);   // the text's black background

  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add rectangle");
  await expect(page.getByRole("region", { name: "rectangle settings" })).toBeVisible();
  await page.getByRole("combobox", { name: "Shape" }).selectOption("arrow");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change shape");
  await expect(page.getByRole("region", { name: "arrow settings" })).toBeVisible();
  await page.getByRole("group", { name: "Colour", exact: true }).getByRole("button", { name: "None" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change shape colour");
  await page.getByRole("button", { name: "Delete arrow" }).click();
  await expect(page.getByRole("region", { name: "arrow settings" })).toHaveCount(0);
});

test("Ctrl+C and Ctrl+V copy a bubble onto other pictures, in the same place, one undo step per paste", async ({ studio, page }) => {
  await addBubble(page, studio, "Hi");
  await page.keyboard.press("ControlOrMeta+c");
  await studio.picture(3).click();
  await page.keyboard.press("ControlOrMeta+v");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Paste speech bubble");
  await expect(objectsOn(page, 3)).toHaveCount(1);
  await expect.poll(() => studio.stageColour(0.33, 0.2)).toEqual([255, 255, 255]);   // where it was on picture 2
  await expect(page.getByRole("region", { name: "speech bubble settings" })).toBeVisible();   // the copy is picked
  await expect(text(page)).toHaveValue("Hi");

  await studio.picture(1).click();
  await studio.picture(3).click({ modifiers: ["Shift"] });   // pictures 1 to 3
  await page.keyboard.press("ControlOrMeta+v");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Paste speech bubble on 3 pictures");
  await expect(objectsOn(page, 1)).toHaveCount(1);
  await studio.undoButton().click();   // one undo takes it off all three
  await expect(objectsOn(page, 1)).toHaveCount(0);
  await expect(objectsOn(page, 3)).toHaveCount(1);   // the first paste stays
});
