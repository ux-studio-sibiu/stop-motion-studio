import type { Page } from "@playwright/test";
import { expect, test, type Studio } from "./fixtures";

// Objects in time (step 24): dropped on the overlay track under the pictures, an object shows over
// every picture in its time, whatever pictures are there. Its bar moves and resizes on the track;
// the object itself is edited on the stage like any other. At the default zoom and speed a tick
// (and a seeded picture) is 20 px wide, and a dropped object lasts 5 ticks (0.63 s).

test.beforeEach(async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(4);
  await studio.picture(1).click();
  await page.getByRole("tab", { name: "Objects" }).click();
});

const TICK = 20;
const YELLOW = [255, 243, 163];   // a new shape's colour
const track = (page: Page) => page.locator("[data-overlay-track]");
const bar = (page: Page) => page.getByRole("button", { name: /^Rectangle, from/ });

// Drags the Shape icon onto the track, at a tick.
async function dropShape(page: Page, studio: Studio, tick: number) {
  const from = (await page.getByRole("button", { name: "Shape", exact: true }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 2 });   // the drag starts: the Objects Layer shows (hidden in a new animation)
  const to = (await track(page).boundingBox())!;
  await page.mouse.move(to.x + tick * TICK + TICK / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add rectangle");
}

// Drags from a point by dx px.
async function dragBy(page: Page, at: { x: number; y: number }, dx: number) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + dx, at.y, { steps: 8 });
  await page.mouse.up();
}

test("dropped on the track, an object shows over the pictures in its time and not the others", async ({ studio, page }) => {
  await dropShape(page, studio, 2);   // from picture 3
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 0.88 s");
  await expect(studio.picture(3)).toHaveAttribute("aria-current", "true");   // the stage went to where it starts
  await expect.poll(() => studio.stageColour()).toEqual(YELLOW);
  await studio.picture(4).click();
  await expect.poll(() => studio.stageColour()).toEqual(YELLOW);
  await studio.picture(2).click();
  await expect.poll(() => studio.stageColour()).not.toEqual(YELLOW);
});

test("its bar moves it in time and its end makes it longer, each one undo step; Delete removes it", async ({ studio, page }) => {
  await dropShape(page, studio, 0);
  const box = (await bar(page).boundingBox())!;
  await dragBy(page, { x: box.x + 60, y: box.y + box.height / 2 }, 2 * TICK);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move rectangle in time");
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 0.88 s");

  const moved = (await bar(page).boundingBox())!;
  await dragBy(page, { x: moved.x + moved.width - 3, y: moved.y + moved.height / 2 }, 4 * TICK);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change when rectangle shows");
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 1.38 s");

  await bar(page).press("Delete");
  await expect(bar(page)).toHaveCount(0);
  await studio.undoButton().click();
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 1.38 s");
});

test("it keeps its time when pictures are deleted, and after a reload", async ({ studio, page }) => {
  await dropShape(page, studio, 2);
  await studio.picture(1).click();
  await page.getByRole("button", { name: "Delete picture" }).click();
  await expect(studio.picture(4)).toHaveCount(0);
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 0.88 s");   // the pictures moved, it didn't

  await page.reload();
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 0.25 s to 0.88 s");
});

test("picked on the track, it's edited on the stage like any object, and stays in time", async ({ studio, page }) => {
  await dropShape(page, studio, 1);
  await studio.picture(4).click();
  await page.getByRole("tab", { name: "Draw" }).click();
  await bar(page).click();   // picks it: the Objects tab, at the picture where it starts
  await expect(page.getByRole("tab", { name: "Objects" })).toHaveAttribute("aria-selected", "true");
  await expect(studio.picture(2)).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "rectangle settings" })).toBeVisible();

  await page.getByRole("combobox", { name: "Shape" }).selectOption("ellipse");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change shape");
  await expect(page.getByRole("button", { name: /^Ellipse, from 0.13 s/ })).toBeVisible();

  const editor = (await page.getByRole("application", { name: /^Objects/ }).boundingBox())!;
  await dragBy(page, { x: editor.x + editor.width / 2, y: editor.y + editor.height / 2 }, 150);
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move ellipse");
  await expect.poll(() => studio.stageColour()).not.toEqual(YELLOW);   // it moved off the middle
  await expect(page.getByRole("button", { name: /^Ellipse, from 0.13 s to 0.75 s/ })).toBeVisible();   // still at its time
});

test("a picked bar is the timeline's only selection: Duplicate and Delete act on it, a picture click switches back, and it's remembered", async ({ studio, page }) => {
  await dropShape(page, studio, 0);   // dropped: picked
  await expect(bar(page)).toHaveAttribute("aria-pressed", "true");
  await expect(studio.picture(1)).toHaveAttribute("aria-selected", "false");   // not selected too: only on the stage
  await expect(studio.picture(1)).toHaveAttribute("aria-current", "true");

  await page.getByRole("region", { name: "Timeline" }).getByRole("button", { name: "Duplicate rectangle" }).click();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Duplicate rectangle");
  const copy = page.getByRole("button", { name: "Rectangle, from 0.63 s to 1.25 s" });   // right after the first
  await expect(copy).toHaveAttribute("aria-pressed", "true");                      // the copy is the selection now
  await expect(studio.pictures()).toHaveCount(4);                                  // no picture was copied

  await page.reload();
  await expect(copy).toHaveAttribute("aria-pressed", "true");   // still picked after a reload

  await page.getByRole("region", { name: "Timeline" }).getByRole("button", { name: "Delete rectangle" }).click();   // the toolbar's
  await expect(copy).toHaveCount(0);
  await expect(studio.pictures()).toHaveCount(4);

  await bar(page).click();
  await studio.picture(3).click();   // pictures again
  await expect(bar(page)).toHaveAttribute("aria-pressed", "false");
  await expect(studio.picture(3)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Delete picture" })).toBeEnabled();
});

test("an overlay that shows at any moment of a picture is on it: one starting partway through is drawn and editable", async ({ studio, page }) => {
  await studio.dragGrip(1, 7 * TICK);   // picture 1 lasts 8 ticks
  await dropShape(page, studio, 3);             // starts in the middle of picture 1
  await page.getByRole("tab", { name: "Draw" }).click();
  await studio.picture(4).click();
  await bar(page).click();
  await expect(studio.picture(1)).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "rectangle settings" })).toBeVisible();
  await expect.poll(() => studio.stageColour()).toEqual(YELLOW);   // drawn on the stage
});

test("a picked overlay keeps its settings in the tab when it isn't on the picture shown, and they still work", async ({ studio, page }) => {
  await dropShape(page, studio, 0);   // picked, on picture 1
  const box = (await bar(page).boundingBox())!;
  await dragBy(page, { x: box.x + 40, y: box.y + box.height / 2 }, 10 * TICK);   // to tick 10: after every picture
  await expect(bar(page)).toHaveAccessibleName("Rectangle, from 1.25 s to 1.88 s");
  await expect(studio.picture(1)).toHaveAttribute("aria-current", "true");   // the stage still shows picture 1
  await expect.poll(() => studio.stageColour()).not.toEqual(YELLOW);                  // where it isn't

  await expect(page.getByRole("region", { name: "Rectangle settings" })).toBeVisible();   // still open, though not on this picture (when it shows is on its bar)
  await page.getByRole("combobox", { name: "Shape" }).selectOption("ellipse");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change shape");
  await expect(page.getByRole("button", { name: "Ellipse, from 1.25 s to 1.88 s" })).toBeVisible();
});
