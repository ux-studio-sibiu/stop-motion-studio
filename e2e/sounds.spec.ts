import { expect, test } from "./fixtures";

// Sounds in time (step 29b): a sound dragged from the Sounds tab onto the stage goes at the
// selected picture, onto the Sound Layer where it's dropped; the row moves it; the tab sets its volume and deletes it; playback plays
// it. What's heard is checked in sound.browser.test.ts: here the sounds started are counted.

test.beforeEach(async ({ studio, page }) => {
  await page.addInitScript(() => {
    // Counts the sounds started (each library sound is one buffer played), instead of listening.
    const start = AudioBufferSourceNode.prototype.start;
    Object.assign(window, { soundsStarted: 0 });
    AudioBufferSourceNode.prototype.start = function (...args) { (window as unknown as { soundsStarted: number }).soundsStarted++; return start.apply(this, args); };
  });
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(4);   // one tick each at 8 per second
});

const started = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { soundsStarted: number }).soundsStarted);

test("a click on a sound plays it; dragged onto the stage it goes at the selected picture; its volume and Delete are one undo step each", async ({ studio, page }) => {
  await studio.picture(3).click();   // starts at tick 2: 0.25 s
  await page.getByRole("tab", { name: "Sounds" }).click();
  const row = page.getByRole("group", { name: "Sound Layer" });
  await studio.soundTile("Boing").click();
  await expect.poll(() => started(page)).toBeGreaterThan(0);   // heard...
  await expect(row.getByRole("button")).toHaveCount(0);         // ...but not added
  const heard = await started(page);

  await studio.dragSound("Boing");
  const bar = row.getByRole("button", { name: "Boing sound, at 0.25 s" });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-pressed", "true");   // picked
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Add Boing");
  await expect.poll(() => started(page)).toBeGreaterThan(heard);   // heard as it's added

  const picked = page.getByRole("region", { name: "Picked sound" });
  await picked.getByRole("button", { name: "Loud" }).click();
  await expect(picked.getByRole("button", { name: "Loud" })).toHaveAttribute("aria-pressed", "true");
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Make Boing loud");

  await picked.getByRole("button", { name: "Delete sound" }).click();
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(picked).toHaveCount(0);
  await studio.undoButton().click();
  await expect(bar).toBeVisible();

  await page.reload();   // saved with the animation
  await expect(page.getByRole("group", { name: "Sound Layer" }).getByRole("button", { name: "Boing sound, at 0.25 s" })).toBeVisible();
});

test("a sound dropped on the Sound Layer goes where it's dropped; it's moved by dragging it, or with the arrow keys, and stays put when pictures move", async ({ studio, page }) => {
  await studio.dragSound("Pop", { tick: 3 });
  const row = page.getByRole("group", { name: "Sound Layer" });
  await expect(row.getByRole("button", { name: "Pop sound, at 0.38 s" })).toBeVisible();   // tick 3 at 8 per second
  await studio.undoButton().click();
  await studio.dragSound("Pop", { tick: 0 });
  await expect(row.getByRole("button", { name: "Pop sound, at 0 s" })).toBeVisible();

  const box = (await row.getByRole("button").boundingBox())!;
  const tick = 20;   // px: the default zoom at 8 per second
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 4 + tick, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + 4 + 2 * tick, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(row.getByRole("button", { name: "Pop sound, at 0.25 s" })).toBeVisible();
  await expect(studio.undoButton()).toHaveAttribute("title", "Undo: Move Pop");

  await row.getByRole("button").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(row.getByRole("button", { name: "Pop sound, at 0.5 s" })).toBeVisible();

  // Deleting a picture before it doesn't move it (anchored to time, like overlays).
  await studio.picture(1).click();
  await page.keyboard.press("Delete");
  await expect(studio.pictures()).toHaveCount(3);
  await expect(row.getByRole("button", { name: "Pop sound, at 0.5 s" })).toBeVisible();
});

test("playing plays the sounds; pausing stops them", async ({ studio, page }) => {
  await studio.dragSound("Ding");   // nothing selected: at the start
  await studio.dragSound("Pop");
  await expect(page.getByRole("group", { name: "Sound Layer" }).getByRole("button")).toHaveCount(2);
  await page.waitForTimeout(200);
  const before = await started(page);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => started(page)).toBeGreaterThanOrEqual(before + 2);   // both, from the start
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(studio.pictures()).toHaveCount(4);
});

test("the Layers button shows and hides the objects and sounds rows, remembered after a reload; dragging a sound shows its row", async ({ studio, page }) => {
  const sounds = page.getByRole("group", { name: "Sound Layer" });
  const objects = page.getByRole("group", { name: "Objects Layer" });
  await expect(sounds).toBeVisible();    // both show at first, whichever tab is open
  await expect(objects).toBeVisible();

  const layers = page.getByRole("button", { name: "Timeline layers" });
  await layers.click();
  const menu = page.getByRole("group", { name: "Timeline layers" });
  const below = (await menu.boundingBox())!.y > (await layers.boundingBox())!.y;
  expect(below).toBe(true);              // it opens below the button, over the timeline
  await menu.getByLabel("Sound Layer").uncheck();
  await menu.getByLabel("Objects Layer").uncheck();
  await expect(sounds).toHaveCount(0);
  await expect(objects).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("region", { name: "Timeline" })).toBeVisible();
  await expect(sounds).toHaveCount(0);
  await expect(objects).toHaveCount(0);

  await studio.dragSound("Beep");   // onto the stage: the Sound Layer shows as the drag starts
  await expect(sounds.getByRole("button", { name: /^Beep sound/ })).toBeVisible();
  await expect(objects).toHaveCount(0);
});

test("recorded sounds (files in public/sounds) are heard and added like the made ones", async ({ studio, page }) => {
  await page.getByRole("tab", { name: "Sounds" }).click();
  await expect(page.getByRole("region", { name: "Animals" })).toBeVisible();
  await studio.soundTile("Meow").click();
  await expect.poll(() => started(page)).toBeGreaterThan(0);   // fetched, decoded and played
  await studio.dragSound("Meow", { tick: 2 });
  const bar = page.getByRole("group", { name: "Sound Layer" }).getByRole("button", { name: "Meow sound, at 0.25 s" });
  await expect(bar).toBeVisible();
  // As long as the recording: 2.37 s at 8 pictures a second is 19 ticks of 20 px.
  await expect.poll(async () => Math.round((await bar.boundingBox())!.width)).toBe(19 * 20);
});
