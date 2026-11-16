import { expect, test } from "./fixtures";

// Moving, sizing, turning and flipping a picture (step 18), on the stage with the camera off and
// in the Picture tab. The Picture tab's fields show where the picture is, in project pixels.

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

test("the Picture tab sets exact numbers, flips and resets", async ({ page }) => {
  await field(page, "Size").fill("150");
  await field(page, "Turn").fill("-30");
  await expect(field(page, "Size")).toHaveValue("150");
  const flip = page.getByRole("button", { name: "Flip left to right" });
  await flip.click();
  await expect(flip).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Reset position" }).click();
  await expect(field(page, "Size")).toHaveValue("100");
  await expect(field(page, "Turn")).toHaveValue("0");
  await expect(flip).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Reset picture");
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
  await page.getByRole("tab", { name: "Camera" }).click();
  await expect(editor).toHaveCount(0);   // no outline, no handle, nothing to drag
  await expect(page.locator(".stage-picture")).toBeVisible();   // the picture is still shown
  await page.getByRole("tab", { name: "Picture" }).click();
  await expect(editor).toBeVisible();
});
