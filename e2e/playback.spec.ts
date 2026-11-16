import { expect, test } from "./fixtures";

// Playback (step 16). Three one-tick pictures at 8 per second last 0.375 s.

test.beforeEach(async ({ studio }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(3);
});

test("Play shows the animation on the stage and stops at the end when not looping", async ({ page }) => {
  await page.getByRole("button", { name: "Loop" }).click();   // looping is on by default
  await expect(page.getByRole("button", { name: "Loop" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.locator(".stage-picture")).toBeVisible();      // over the live camera while playing
  await expect(page.locator(".playhead.is-playing")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 3000 });   // it ended by itself
  await expect(page.locator(".stage-picture")).toHaveCount(0);   // the live camera again
});

test("Enter plays and pauses; pausing selects the picture it stopped on", async ({ studio, page }) => {
  await studio.track().focus();
  await page.keyboard.press("Escape");   // nothing selected: play from the start
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(studio.selected()).toHaveCount(1);
});

test("the speed control changes how fast it plays, scaling the timeline; undo puts it back", async ({ studio, page }) => {
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
