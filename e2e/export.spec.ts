import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { readGif } from "../src/adapters/export/gifReader";
import { expect, test } from "./fixtures";

// Save as GIF (step 25): the toolbar button downloads a GIF of the animation, at the size picked
// in its options, with its quality (both remembered). The file is read back here: its size, its pictures and their delays.

test.beforeEach(async ({ studio }) => {
  await studio.withoutCamera();
  await studio.open();
});

async function saveGif(page: Page) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save as GIF" }).click();
  const download = await downloading;
  const bytes = new Uint8Array(await readFile((await download.path())!));
  const { header, width, height, delays } = readGif(bytes);
  return { name: download.suggestedFilename(), gif: { header, width, height, delays }, bytes: bytes.length };
}

test("Save as GIF downloads the animation: inside the safe zone, every picture as long as it's held", async ({ studio, page }) => {
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
  await page.getByRole("button", { name: "GIF options" }).click();
  const sizes = page.getByRole("group", { name: "GIF size" });
  await expect(sizes.getByRole("button", { name: /^Medium/ })).toHaveAttribute("aria-pressed", "true");
  await sizes.getByRole("button", { name: /^Small/ }).click();
  await expect(sizes.getByRole("button", { name: /^Small/ })).toHaveAttribute("aria-pressed", "true");   // the options stay open

  await page.reload();
  expect(await saveGif(page).then(({ gif }) => [gif.width, gif.height])).toEqual([320, 180]);

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

  await page.getByRole("button", { name: "GIF options" }).click();
  const quality = page.getByRole("slider", { name: "Quality" });
  await expect(quality).toHaveAttribute("aria-valuetext", "medium");   // the default
  await quality.fill("2");
  await expect(quality).toHaveAttribute("aria-valuetext", "high, biggest file");
  await page.keyboard.press("Escape");
  const high = await saveGif(page);

  await page.reload();
  await page.getByRole("button", { name: "GIF options" }).click();
  await expect(page.getByRole("slider", { name: "Quality" })).toHaveAttribute("aria-valuetext", "high, biggest file");   // remembered
  await page.getByRole("slider", { name: "Quality" }).fill("1");
  await page.keyboard.press("Escape");
  const medium = await saveGif(page);

  expect(medium.gif.delays).toEqual(high.gif.delays);   // the same pictures, as long
  expect(medium.bytes).toBeLessThan(high.bytes * 0.8);   // the copies stored as "nothing changed"
});
