import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Objects on pictures (step 23), in the Objects tab with the camera off: dragging a speech bubble
// onto the picture (or clicking it), typing its text and choosing its settings in the tab, moving, sizing and deleting it on the
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
const undo = (page: Page) => page.getByRole("button", { name: "Undo" });
const badge = (page: Page, number: number) => page.getByRole("option", { name: `Picture ${number}`, exact: true }).locator(".badge");

// The colour the stage draws at a point given as fractions of the picture.
const stageColour = (page: Page, x: number, y: number) => page.locator(".stage-picture").evaluate((canvas: HTMLCanvasElement, at) => [...canvas.getContext("2d")!.getImageData(Math.round(canvas.width * at.x), Math.round(canvas.height * at.y), 1, 1).data.slice(0, 3)], { x, y });
// A point of the stage, as fractions of it, in page pixels.
const onStage = async (page: Page, x: number, y: number) => { const box = (await editor(page).boundingBox())!; return { x: box.x + box.width * x, y: box.y + box.height * y }; };

const tile = (page: Page) => page.getByRole("button", { name: "Speech bubble", exact: true });

async function addBubble(page: Page, typed?: string) {
  await tile(page).click();   // a click puts it near the top
  await expect(text(page)).toBeFocused();   // typing straight away
  if (typed) {
    await page.keyboard.type(typed);
    await text(page).blur();   // done: saved now
    await expect(undo(page)).toHaveAttribute("title", "Undo: Change bubble text");
  } else {
    await expect(undo(page)).toHaveAttribute("title", "Undo: Add speech bubble");
  }
}

test("a new bubble's text is typed in the tab, drawn on the picture, and kept after a reload", async ({ studio, page }) => {
  await addBubble(page, "Hello!");
  await expect.poll(() => stageColour(page, 0.33, 0.2)).toEqual([255, 255, 255]);   // the white bubble, drawn on the picture
  await expect(badge(page, 2)).toHaveCount(1);
  await expect(badge(page, 1)).toHaveCount(0);

  await page.reload();
  await studio.picture(2).click();
  await expect(text(page)).toHaveCount(0);      // nothing picked
  const middle = await onStage(page, 0.5, 0.2);
  await page.mouse.click(middle.x, middle.y);   // pick it
  await expect(text(page)).toHaveValue("Hello!");
  await editor(page).press("Enter");            // Enter goes to its text
  await expect(text(page)).toBeFocused();
});

test("a bubble dragged onto the picture lands where it's dropped; dropped elsewhere, nothing is added", async ({ page }) => {
  const from = (await tile(page).boundingBox())!;
  const drop = async (to: { x: number; y: number }) => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  };
  await drop({ x: from.x - 30, y: from.y + 400 });   // the panel, below the tiles: not the picture
  await expect(undo(page)).toBeDisabled();

  await drop(await onStage(page, 0.3, 0.7));
  await expect(undo(page)).toHaveAttribute("title", "Undo: Add speech bubble");
  await expect(text(page)).toBeFocused();   // typing straight away
  await expect.poll(() => stageColour(page, 0.3, 0.7)).toEqual([255, 255, 255]);   // centred where it was dropped
  await expect.poll(() => stageColour(page, 0.5, 0.2)).not.toEqual([255, 255, 255]);   // not at the top
});

test("the thumbnail shows the bubble, and follows it while it's dragged", async ({ studio, page }) => {
  // Whether the thumbnail's objects canvas has paint at a point, as fractions of the picture.
  const painted = (x: number, y: number) => studio.thumbObjects(2).evaluate((canvas: HTMLCanvasElement, at) => canvas.getContext("2d")!.getImageData(Math.round(canvas.width * at.x), Math.round(canvas.height * at.y), 1, 1).data[3] > 0, { x, y });
  await expect(studio.thumbObjects(2)).toHaveCount(0);
  await addBubble(page);
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

test("drag moves a bubble, a corner sizes it, Delete removes it; each is one undo step", async ({ page }) => {
  await addBubble(page);
  const middle = await onStage(page, 0.5, 0.2);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 80, middle.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(undo(page)).toHaveAttribute("title", "Undo: Move speech bubble");

  const corner = page.locator(".handles .corner.is-se");
  const at = (await corner.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(undo(page)).toHaveAttribute("title", "Undo: Size speech bubble");

  await editor(page).press("Delete");
  await expect(badge(page, 2)).toHaveCount(0);
  await undo(page).click();
  await expect(badge(page, 2)).toHaveCount(1);
});

test("a bubble stays with its picture when the picture moves, and a copy gets one too", async ({ studio, page }) => {
  await studio.picture(3).click();
  await addBubble(page, "Me!");
  await studio.picture(3).click();
  await page.keyboard.press("ControlOrMeta+ArrowLeft");
  await page.keyboard.press("ControlOrMeta+ArrowLeft");   // picture 3 is now the first
  await expect(badge(page, 1)).toHaveCount(1);
  await expect(badge(page, 3)).toHaveCount(0);

  await studio.picture(1).click();
  await studio.duplicateButton().click();
  await expect(badge(page, 2)).toHaveCount(1);   // the copy, right after it
});

test("shape, tail, outline, text size, font and colours are set in the tab, each one undo step", async ({ page }) => {
  await addBubble(page);
  await page.getByLabel("Shape").selectOption("spiked");
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change bubble shape");
  await expect(page.locator(".handles .tail")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Tail" }).uncheck();
  await expect(undo(page)).toHaveAttribute("title", "Undo: Hide bubble tail");
  await expect(page.locator(".handles .tail")).toHaveCount(0);   // no tail, nothing to drag
  await page.getByRole("combobox", { name: "Outline", exact: true }).selectOption("thick");
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change outline");
  await page.getByRole("group", { name: "Outline colour" }).getByRole("button", { name: "Blue" }).click();
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change outline colour");
  await page.getByRole("combobox", { name: "Outline", exact: true }).selectOption("none");
  await expect(page.getByRole("group", { name: "Outline colour" })).toHaveCount(0);   // nothing to colour
  await page.getByLabel("Text size").selectOption("huge");
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change text size");
  await page.getByLabel("Font").selectOption("comic");
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change font");
  await page.getByRole("group", { name: "Text colour" }).getByRole("button", { name: "Red" }).click();
  await expect(undo(page)).toHaveAttribute("title", "Undo: Change text colour");

  const black = page.getByRole("group", { name: "Bubble colour" }).getByRole("button", { name: "Black" });
  await black.click();
  await expect(black).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => stageColour(page, 0.5, 0.2)).toEqual([31, 36, 51]);   // the bubble, now black
  await undo(page).click();
  await expect.poll(() => stageColour(page, 0.5, 0.2)).toEqual([255, 255, 255]);
  await expect(page.getByLabel("Shape")).toHaveValue("spiked");   // only the colour was undone

  await page.getByRole("button", { name: "Delete spiked bubble" }).click();
  await expect(badge(page, 2)).toHaveCount(0);
});
