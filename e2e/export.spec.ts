import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { readGif } from "../src/adapters/export/gifReader";
import { expect, test } from "./fixtures";

// Save as GIF (step 25), in the Save menu under the back arrow: downloads a GIF of the animation, at the size picked
// in its options, with its quality (both remembered). The file is read back here: its size, its pictures and their delays.

test.beforeEach(async ({ studio }) => {
  await studio.withoutCamera();
  await studio.open();
});

// The ways to save are in the Save menu, under the back arrow: open it (if it isn't).
async function openSave(page: Page) {
  const save = page.getByRole("button", { name: "Save", exact: true });
  if ((await save.getAttribute("aria-expanded")) !== "true") await save.click();
}

async function saveGif(page: Page) {
  await openSave(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save as GIF" }).click();
  const download = await downloading;
  const bytes = new Uint8Array(await readFile((await download.path())!));
  const { header, width, height, delays } = readGif(bytes);
  return { name: download.suggestedFilename(), gif: { header, width, height, delays }, bytes: bytes.length };
}

test("Save as GIF downloads the animation: inside the safe zone, every picture as long as it's held", async ({ studio, page }) => {
  await openSave(page);
  await expect(page.getByRole("button", { name: "Save as GIF" })).toBeDisabled();   // nothing to save yet
  await studio.seedPictures(3);   // one tick each at 8 per second
  const { name, gif } = await saveGif(page);
  expect(name).toMatch(/\.gif$/);
  // 1280 × 720 inside the safe zone is 1208 × 680 (still 16:9), scaled to 640 wide (medium, the default)
  expect(gif).toEqual({ header: "GIF89a", width: 640, height: 360, delays: [13, 12, 13] });   // 3 / 8 s in all
  await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible();
});

test("the GIF size is picked in its options and remembered", async ({ studio, page }) => {
  await studio.seedPictures(2);
  await openSave(page);
  await page.getByRole("button", { name: "GIF options" }).click();
  const sizes = page.getByRole("group", { name: "GIF size" });
  await expect(sizes.getByRole("button", { name: /^Medium/ })).toHaveAttribute("aria-pressed", "true");
  await sizes.getByRole("button", { name: /^Small/ }).click();
  await expect(sizes.getByRole("button", { name: /^Small/ })).toHaveAttribute("aria-pressed", "true");   // the options stay open

  await page.reload();
  expect(await saveGif(page).then(({ gif }) => [gif.width, gif.height])).toEqual([320, 180]);

  await openSave(page);
  await page.getByRole("button", { name: "GIF options" }).click();
  await expect(sizes.getByRole("button", { name: "Full size 1208 px wide" })).toBeVisible();   // as it is, inside the safe zone
  await sizes.getByRole("button", { name: /^Full size/ }).click();
  await page.keyboard.press("Escape");
  expect(await saveGif(page).then(({ gif }) => [gif.width, gif.height])).toEqual([1208, 680]);
});

test("the quality slider makes the file smaller when the pictures barely change, and is remembered", async ({ studio, page }) => {
  await studio.seedPictures(1);
  await studio.picture(1).click();
  await page.keyboard.press("ControlOrMeta+d");   // three copies of one picture: nothing changes between them
  await page.keyboard.press("ControlOrMeta+d");
  await expect(studio.pictures()).toHaveCount(3);

  await openSave(page);
  await page.getByRole("button", { name: "GIF options" }).click();
  const quality = page.getByRole("slider", { name: "Quality" });
  await expect(quality).toHaveAttribute("aria-valuetext", "medium");   // the default
  await quality.fill("2");
  await expect(quality).toHaveAttribute("aria-valuetext", "high, biggest file");
  await page.keyboard.press("Escape");
  const high = await saveGif(page);

  await page.reload();
  await openSave(page);
  await page.getByRole("button", { name: "GIF options" }).click();
  await expect(page.getByRole("slider", { name: "Quality" })).toHaveAttribute("aria-valuetext", "high, biggest file");   // remembered
  await page.getByRole("slider", { name: "Quality" }).fill("1");
  await page.keyboard.press("Escape");
  const medium = await saveGif(page);

  expect(medium.gif.delays).toEqual(high.gif.delays);   // the same pictures, as long
  expect(medium.bytes).toBeLessThan(high.bytes * 0.8);   // the copies stored as "nothing changed"
});

// Save as video (step 26): the file is read back with Mediabunny's own reader.
test("Save as video downloads the animation: its full exported size, as long as it plays, a frame per change", async ({ studio, page }) => {
  const { ALL_FORMATS, BufferSource, Input } = await import("mediabunny");
  await openSave(page);
  await expect(page.getByRole("button", { name: "Save as video" })).toBeDisabled();   // nothing to save yet
  await studio.seedPictures(3);   // one tick each at 8 per second: 0.375 s
  await studio.picture(2).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("]");   // picture 2 held for 4 ticks: one frame, half a second

  const downloading = page.waitForEvent("download");
  await openSave(page);
  await page.getByRole("button", { name: "Save as video" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  await expect(page.getByRole("status").filter({ hasText: /^Saved .*\.(mp4|webm)$/ })).toBeVisible();

  const bytes = await readFile((await download.path())!);
  using input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  const track = (await input.getPrimaryVideoTrack())!;
  expect([track.displayWidth, track.displayHeight]).toEqual([1208, 680]);   // inside the safe zone, 16:9
  expect(await input.computeDuration()).toBeCloseTo(0.75, 2);              // 1 + 4 + 1 ticks at 8 per second
  expect((await track.computePacketStats()).packetCount).toBe(3);
});

// Sounds in the video (step 29b): the sound row is mixed into an audio track (AAC in an MP4, Opus
// in a WebM), and the video is as long as before.
test("Save as video carries the sounds as an audio track", async ({ studio, page }) => {
  const { ALL_FORMATS, BufferSource, Input } = await import("mediabunny");
  await studio.seedPictures(4);   // 0.5 s
  await studio.dragSound("Pop");
  await expect(page.getByRole("group", { name: "Sound Layer" }).getByRole("button")).toHaveCount(1);

  const downloading = page.waitForEvent("download");
  await openSave(page);
  await page.getByRole("button", { name: "Save as video" }).click();
  const bytes = await readFile((await (await downloading).path())!);
  using input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  const audio = await input.getPrimaryAudioTrack();
  expect(audio).not.toBeNull();
  expect(["aac", "opus"]).toContain(audio!.codec);
  expect(await input.computeDuration()).toBeCloseTo(0.5, 1);
});

test("the Save button sits under the back arrow and lists Save as video, then Save as GIF with its options", async ({ studio, page }) => {
  await studio.seedPictures(1);
  const back = (await page.getByRole("link", { name: "All projects" }).boundingBox())!;
  const save = page.getByRole("button", { name: "Save", exact: true });
  const box = (await save.boundingBox())!;
  expect(box.y).toBeGreaterThan(back.y + back.height);   // under it...
  expect(Math.abs(box.x - back.x)).toBeLessThan(2);       // ...lined up with it
  await expect(page.getByRole("button", { name: "Save as video" })).toBeHidden();
  await save.click();
  const list = page.getByRole("group", { name: "Save as" });
  const names = await list.locator(":scope > .export-menu > .toggle").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(names).toEqual(["Save as video", "Save as GIF"]);
  await expect(list.getByRole("button", { name: "GIF options" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
});
