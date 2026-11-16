import { expect, test } from "./fixtures";

// The stage (step 15): the live camera while it's on; with it off, the selected picture (or the
// last one), drawn by the renderer.

test("with the camera off, the stage shows the selected picture, drawn from the saved photo", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);

  const stage = page.getByRole("img", { name: /^Picture \d+$/ });
  await expect(stage).toHaveAccessibleName("Picture 2");   // nothing selected: the last picture
  await studio.picture(1).click();
  await expect(stage).toHaveAccessibleName("Picture 1");

  // The seeded pictures are strongly coloured: once decoded, the stage shows that colour, not the
  // black the canvas starts with. (Several points, in case one hits the white square.)
  await expect.poll(() => stage.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const points = [0.1, 0.3, 0.5, 0.7, 0.9].map((x) => ctx.getImageData(Math.round(canvas.width * x), Math.round(canvas.height * 0.8), 1, 1).data);
    return points.filter(([r, g, b]) => Math.max(r, g, b) > 80 && Math.max(r, g, b) - Math.min(r, g, b) > 40).length;
  })).toBeGreaterThanOrEqual(3);

  // The safe zone: the edge band the video leaves out, veiled, with its dotted line.
  await expect(page.locator(".safe-zone .edge")).toBeVisible();

  // Nothing covers the picture: turning the camera back on is in the camera box beside it.
  await expect(page.getByRole("button", { name: "Turn on camera" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
});

test("on a phone, where there's no camera box, the stage keeps a small bar to turn the camera on", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(1);
  await page.setViewportSize({ width: 390, height: 800 });   // the camera box is hidden on phones (its drawer comes later)
  await expect(page.getByRole("button", { name: "Turn on camera" })).toBeVisible();
});

test("with the camera on, the stage stays live even with a picture selected", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(1);
  await studio.picture(1).click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator(".stage-picture")).toHaveCount(0);
  await expect(page.locator(".safe-zone")).toBeVisible();   // over the live camera too, to frame the shot

  // Playing draws the animation over the live camera; pausing shows the camera again.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".stage-picture")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator(".stage-picture")).toHaveCount(0);
});

test("see-through shows the last picture faintly over the live camera, and remembers its settings", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  const ghost = page.locator(".onion-skin");
  await expect(ghost).toHaveCount(0);   // nothing to see through before the first picture
  await studio.takePictures(1);
  await expect(ghost).toBeVisible();
  // Drawn and see-through: the middle of the ghost is about 40% opaque.
  await expect.poll(() => ghost.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(40, canvas.height / 2, 1, 1).data[3])).toBeGreaterThan(90);
  expect(await ghost.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(40, canvas.height / 2, 1, 1).data[3])).toBeLessThan(115);

  // Its options are in a dropdown on the button.
  await page.getByRole("button", { name: "See-through options" }).click();
  const options = page.getByRole("group", { name: "See-through options" });
  await options.getByRole("button", { name: "2 pictures" }).click();
  await expect(options.getByRole("button", { name: "2 pictures" })).toHaveAttribute("aria-pressed", "true");
  await options.getByRole("checkbox", { name: "Outline only" }).check();
  // The ghost is now black and white: no colour left in the fake camera's green.
  await expect.poll(() => ghost.evaluate((canvas: HTMLCanvasElement) => {
    const [r, g, b] = canvas.getContext("2d")!.getImageData(40, canvas.height * 0.8, 1, 1).data;
    return Math.max(r, g, b) - Math.min(r, g, b);
  })).toBeLessThanOrEqual(3);
  await page.keyboard.press("Escape");
  await expect(options).toHaveCount(0);

  const toggle = page.getByRole("button", { name: "See-through", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(ghost).toHaveCount(0);

  await page.reload();   // still off after a reload
  await expect(studio.pictures()).toHaveCount(1);
  await expect(page.getByRole("button", { name: "See-through", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("with the camera off, see-through shows the picture before the one on the stage", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  const ghost = page.locator(".onion-skin");
  await expect(ghost).toBeVisible();          // over picture 2: picture 1, faintly
  await studio.picture(1).click();
  await expect(ghost).toHaveCount(0);         // nothing before picture 1
  await studio.picture(2).click();
  await expect(ghost).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(ghost).toHaveCount(0);         // hidden while it plays
});

test("spot the difference is a see-through look, instead of outline only; it's remembered", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  const ghost = page.locator(".onion-skin");
  await page.getByRole("button", { name: "See-through options" }).click();
  const difference = page.getByRole("checkbox", { name: "Spot the difference" });
  const outline = page.getByRole("checkbox", { name: "Outline only" });

  await difference.check();
  await expect(ghost).toHaveClass(/is-difference/);
  expect(await ghost.evaluate((element) => getComputedStyle(element).mixBlendMode)).toBe("difference");
  await expect(page.getByRole("slider", { name: "How strong" })).toBeDisabled();   // always full strength

  await outline.check();   // one look at a time
  await expect(difference).not.toBeChecked();
  await expect(ghost).not.toHaveClass(/is-difference/);
  await difference.check();
  await expect(outline).not.toBeChecked();

  await page.reload();
  await page.getByRole("button", { name: "See-through options" }).click();
  await expect(page.getByRole("checkbox", { name: "Spot the difference" })).toBeChecked();
  await expect(ghost).toHaveClass(/is-difference/);
});

test("the side panel's tabs switch between camera and picture, and the arrow keys move between them", async ({ studio, page }) => {
  await studio.open();
  const cameraTab = page.getByRole("tab", { name: "Camera" });
  const pictureTab = page.getByRole("tab", { name: "Picture" });
  await expect(cameraTab).toHaveAttribute("aria-selected", "true");   // open to start with
  await expect(page.getByRole("button", { name: /^Turn camera (on|off)$/ })).toBeVisible();

  await pictureTab.click();
  await expect(pictureTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Picture" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Turn camera (on|off)$/ })).toBeHidden();

  await page.keyboard.press("ArrowUp");
  await expect(cameraTab).toHaveAttribute("aria-selected", "true");
  await expect(cameraTab).toBeFocused();

  await pictureTab.click();
  await page.reload();   // the open tab is remembered
  await expect(page.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
});

test("the safe zone can be set from 0 to 60 px; it's saved with the animation and undoable", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(1);
  const edge = page.locator(".safe-zone .edge");
  await expect(edge).toHaveAttribute("x", "20");   // the default

  await page.getByRole("button", { name: "See-through options" }).click();
  const slider = page.getByRole("slider", { name: "Safe zone" });
  await slider.fill("45");
  await expect(edge).toHaveAttribute("x", "45");   // the stage follows while dragging
  await slider.press("ArrowRight");                // a key press saves, like letting go
  await expect(edge).toHaveAttribute("x", "50");
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo: Change safe zone");

  await page.reload();   // saved with the animation
  await expect(page.locator(".safe-zone .edge")).toHaveAttribute("x", "50");
  await page.getByRole("button", { name: "See-through options" }).click();
  await page.getByRole("slider", { name: "Safe zone" }).fill("0");
  await page.getByRole("slider", { name: "Safe zone" }).press("Tab");   // leaving the slider saves too
  await expect(page.locator(".safe-zone")).toHaveCount(0);              // 0: the whole picture is filmed
});
