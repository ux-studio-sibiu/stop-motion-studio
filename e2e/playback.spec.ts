import { expect, test } from "./fixtures";

// Playback (step 16). Three one-tick pictures at 8 per second last 0.375 s.

test.beforeEach(async ({ studio }) => {
  await studio.withoutCamera();   // playing over the live camera is checked in stage.spec.ts
  await studio.open();
  await studio.seedPictures(3);
});

test("Play shows the animation on the stage and stops at the end when not looping", async ({ studio, page }) => {
  await studio.picture(1).click();
  for (let i = 0; i < 7; i++) await page.keyboard.press("]");   // picture 1 lasts 8 ticks: the whole thing plays for 1.25 s
  await page.keyboard.press("Escape");                         // nothing selected: play from the start
  await page.getByRole("button", { name: "Playback options" }).click();   // speed and loop are in a dropdown
  const loop = page.getByRole("checkbox", { name: /^Loop/ });
  await expect(loop).toBeChecked();   // looping is on by default
  await loop.uncheck();
  await page.keyboard.press("Escape");   // close the options
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.locator(".stage-picture")).toBeVisible();
  await expect(page.locator(".playhead.is-playing")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 3000 });   // it ended by itself
  await expect(page.locator(".playhead.is-playing")).toHaveCount(0);
  await expect(studio.selected()).toHaveCount(0);   // back to the start for the next Play
});

test("Enter plays and pauses; pausing selects the picture it stopped on", async ({ studio, page }) => {
  await studio.track().focus();
  await page.keyboard.press("Escape");   // nothing selected: play from the start
  const playSize = await page.getByRole("button", { name: "Play", exact: true }).boundingBox();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const pauseSize = await page.getByRole("button", { name: "Pause" }).boundingBox();
  expect([pauseSize?.width, pauseSize?.height]).toEqual([playSize?.width, playSize?.height]);   // the button doesn't change size
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(studio.selected()).toHaveCount(1);
});

test("the speed control changes how fast it plays, scaling the timeline; undo puts it back", async ({ studio, page }) => {
  await page.getByRole("button", { name: "Playback options" }).click();
  const speed = page.getByRole("slider", { name: "Speed" });
  await expect(speed).toHaveAttribute("aria-valuetext", "8 pictures per second");
  await speed.fill("4");   // the fastest: 15
  await expect(speed).toHaveAttribute("aria-valuetext", "15 pictures per second");
  await expect.poll(() => studio.widthOf(studio.picture(1))).toBeCloseTo(160 / 15, 0);   // a tick is narrower
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Change speed");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(speed).toHaveAttribute("aria-valuetext", "8 pictures per second");
});

test("dragging along the ruler scrubs: the picture under the pointer is selected", async ({ studio, page }) => {
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const second = (await studio.picture(2).boundingBox())!;
  await page.mouse.move(second.x + 5, ruler.y + ruler.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(studio.picture(2)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".playhead")).toHaveCount(1);
});

test("the loop setting is remembered after a reload", async ({ page }) => {
  await page.getByRole("button", { name: "Playback options" }).click();
  await page.getByRole("checkbox", { name: /^Loop/ }).uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Playback options" }).click();
  await expect(page.getByRole("checkbox", { name: /^Loop/ })).not.toBeChecked();
});
