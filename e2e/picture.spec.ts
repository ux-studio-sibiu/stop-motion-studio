import { expect, test } from "./fixtures";

// Editing a picture: moving, sizing, turning and flipping it (step 18), lining it up (step 19:
// snapping) and its brightness and contrast (step 20), on the stage with the
// camera off and in the Picture tab. The Picture tab's fields show where the picture is, in project pixels.

test.beforeEach(async ({ studio, page }) => {
  await studio.withoutCamera();   // editing is on the picture, not the live camera
  await studio.open();
  await studio.seedPictures(2);
  await studio.picture(1).click();
  await page.getByRole("tab", { name: "Picture" }).click();
});

const field = (page: import("@playwright/test").Page, name: string) => page.getByRole("spinbutton", { name });

test("dragging the picture on the stage moves it; one undo puts it back; it's saved", async ({ page }) => {
  const editor = page.getByRole("application", { name: /^Move the picture/ });
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  const x = Number(await field(page, "Left / right").inputValue());
  expect(x).toBeGreaterThan(100);   // more project pixels than screen pixels: the stage is smaller than 1280
  expect(Number(await field(page, "Up / down").inputValue())).toBeGreaterThan(30);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Move picture");

  await page.getByRole("button", { name: "Undo" }).click();   // one step back to the centre
  await expect(field(page, "Left / right")).toHaveValue("0");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(field(page, "Left / right")).toHaveValue(String(x));

  await page.reload();   // saved: picture 1 is still moved
  await page.getByRole("option", { name: "Picture 1", exact: true }).click();
  await page.getByRole("tab", { name: "Picture" }).click();
  await expect(field(page, "Left / right")).toHaveValue(String(x));
});

test("arrow keys nudge exactly one project pixel (Shift: ten), and a burst is one undo step", async ({ page }) => {
  const editor = page.getByRole("application", { name: /^Move the picture/ });
  await editor.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(field(page, "Left / right")).toHaveValue("10");
  await expect(field(page, "Up / down")).toHaveValue("10");
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled({ timeout: 3000 });   // saved once the burst stops

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field(page, "Left / right")).toHaveValue("0");
  await expect(field(page, "Up / down")).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();   // all of it was one step
});

test("the wheel sizes the picture, and + / - from the keyboard", async ({ page }) => {
  const editor = page.getByRole("application", { name: /^Move the picture/ });
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => Number(await field(page, "Size").inputValue())).toBeGreaterThan(100);
  await editor.focus();
  const before = Number(await field(page, "Size").inputValue());
  await page.keyboard.press("-");
  await expect.poll(async () => Number(await field(page, "Size").inputValue())).toBeLessThan(before);
});

test("the round handle turns the picture", async ({ page }) => {
  const handle = page.locator(".turn-handle circle");
  const box = (await handle.boundingBox())!;
  const editor = (await page.getByRole("application", { name: /^Move the picture/ }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(editor.x + editor.width * 0.9, editor.y + editor.height * 0.4, { steps: 10 });   // round to the right
  await page.mouse.up();
  await expect.poll(async () => Number(await field(page, "Turn").inputValue())).toBeGreaterThan(20);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Turn picture");
});

test("the Picture tab sets exact numbers, flips and resets; the thumbnail follows", async ({ studio, page }) => {
  await field(page, "Size").fill("150");
  await field(page, "Turn").fill("-30");
  await expect(field(page, "Size")).toHaveValue("150");
  const flip = page.getByRole("button", { name: "Flip left to right" });
  await flip.click();
  await expect(flip).toHaveAttribute("aria-pressed", "true");
  // The thumbnail shows the picture sized, turned and flipped, as the stage does.
  const thumb = studio.thumbPhoto(1);
  await expect.poll(() => thumb.evaluate((element) => element.style.transform)).toContain("rotate(-30deg) scale(-1.5, 1.5)");

  await page.getByRole("button", { name: "Reset position" }).click();
  await expect(field(page, "Size")).toHaveValue("100");
  await expect(field(page, "Turn")).toHaveValue("0");
  await expect(flip).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Reset picture");
  await expect.poll(() => thumb.evaluate((element) => element.style.transform)).toBe("");
});

test("with two pictures selected, they move together", async ({ studio, page }) => {
  await studio.picture(2).click({ modifiers: ["Shift"] });
  await page.getByRole("application", { name: /^Move the picture/ }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Move picture (2 pictures)", { timeout: 3000 });
  await studio.picture(2).click();   // just picture 2 now
  await expect(field(page, "Left / right")).toHaveValue("-5");
});

test("the stage's editing tools are there only while the Picture tab is open", async ({ page }) => {
  const editor = page.getByRole("application", { name: /^Move the picture/ });
  await expect(editor).toBeVisible();
  await page.getByRole("tab", { name: "Draw" }).click();
  await expect(editor).toHaveCount(0);   // no outline, no handle, nothing to drag
  await expect(page.locator(".stage-picture")).toBeVisible();   // the picture is still shown
  await page.getByRole("tab", { name: "Picture" }).click();
  await expect(editor).toBeVisible();
});

// Lining up (step 19): snapping while dragging; a pinch sizes the picture, never the stage.

test("a drag snaps to the stage's centre, with a guide; with Alt it doesn't", async ({ page }) => {
  const editor = page.getByRole("application", { name: /^Move the picture/ });
  const box = (await editor.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 4, middle.y + 3, { steps: 4 });
  await expect(page.locator(".guide")).toHaveCount(2);   // centred on both axes
  await page.mouse.up();
  await expect(page.locator(".guide")).toHaveCount(0);
  await expect(field(page, "Left / right")).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();   // nothing moved, nothing saved

  await page.keyboard.down("Alt");
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 4, middle.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect(field(page, "Left / right")).not.toHaveValue("0");
});

test("a pinch (Ctrl + wheel) sizes this picture only; the safe zone and the other pictures stay as they were", async ({ studio, page }) => {
  const zone = page.locator(".safe-zone");
  const zoneBefore = await zone.boundingBox();
  const box = (await page.locator(".stage-frame").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -10);   // a pinch outwards sends small deltas
  await page.keyboard.up("Control");
  await expect.poll(async () => Number(await field(page, "Size").inputValue())).toBeGreaterThan(100);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Size picture");
  expect(await zone.boundingBox()).toEqual(zoneBefore);   // the safe zone didn't move or grow

  await studio.picture(2).click();
  await expect(field(page, "Size")).toHaveValue("100");
  expect(await zone.boundingBox()).toEqual(zoneBefore);
});

// Brightness and contrast (step 20), in the Picture tab.

// The colour in the middle of the stage picture, as drawn.
const brightness = (page: import("@playwright/test").Page) => page.getByRole("slider", { name: "Brightness" });

test("brightness shows on the stage and the thumbnail; a run of arrow presses is one undo; it's saved", async ({ studio, page }) => {
  const before = await studio.stageColour();
  await brightness(page).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Brightness: 120%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Change brightness");
  const after = await studio.stageColour();
  expect(after.reduce((a, b) => a + b)).toBeGreaterThan(before.reduce((a, b) => a + b));   // brighter
  await expect(studio.thumbPhoto(1)).toHaveCSS("filter", "brightness(1.2)");

  await page.getByRole("button", { name: "Undo" }).click();   // the four presses, in one step
  await expect(page.getByText("Brightness: 100%")).toBeVisible();
  await expect.poll(() => studio.stageColour()).toEqual(before);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Brightness: 120%")).toBeVisible();

  await page.reload();
  await studio.picture(1).click();
  await expect(page.getByText("Brightness: 120%")).toBeVisible();
});

test("with several selected, the sliders change them all as one undo; Reset puts them back", async ({ studio, page }) => {
  await studio.picture(2).click({ modifiers: ["Shift"] });
  await page.getByRole("slider", { name: "Contrast" }).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Contrast: 90%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Change contrast (2 pictures)");
  await studio.picture(2).click();   // just picture 2 now
  await expect(page.getByText("Contrast: 90%")).toBeVisible();

  await studio.picture(1).click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Reset brightness and contrast" }).click();
  await expect(page.getByText("Contrast: 100%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Reset brightness and contrast (2 pictures)");
  await expect(page.getByRole("button", { name: "Reset brightness and contrast" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Contrast: 90%")).toBeVisible();
});
