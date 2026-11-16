import { expect, test } from "./fixtures";

// The stage (step 15): the live camera while it's on; with it off, the selected picture (or the
// last one), drawn by the renderer.

test("with the camera off, the stage shows the selected picture, drawn from the saved photo", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(2);
  await page.getByRole("button", { name: "Camera off" }).click();

  const stage = page.getByRole("img", { name: /^Picture \d+$/ });
  await expect(stage).toHaveAccessibleName("Picture 2");   // the last picture taken is selected
  await studio.picture(1).click();
  await expect(stage).toHaveAccessibleName("Picture 1");

  // The fake camera films a green background: once decoded, the middle-left of the stage is
  // green, not the black the canvas starts with.
  await expect.poll(() => stage.evaluate((canvas: HTMLCanvasElement) => {
    const [r, g, b] = canvas.getContext("2d")!.getImageData(40, canvas.height / 2, 1, 1).data;
    return g > 100 && g > r + 40 && g > b + 40;
  })).toBe(true);

  await expect(page.getByRole("button", { name: "Turn on camera" })).toBeVisible();   // still one tap away
});

test("with the camera on, the stage stays live even with a picture selected", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(1);
  await studio.picture(1).click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator(".stage-picture")).toHaveCount(0);
});
