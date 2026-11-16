import { expect, test } from "./fixtures";

// Tagged @real-camera: these need the browser's own fake webcam (Chromium only, see
// playwright.config.ts). The blocked-camera test fakes the error itself, so it runs everywhere.

test("the camera turns on and shows a live picture @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();

  await expect(studio.video()).toBeVisible();
  // The fake webcam plays a 320x240 video: frames are really arriving.
  await expect.poll(() => studio.video().evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(320);
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();
});

test("turning the camera off stops it, and so does leaving the studio @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();

  // Keep a handle on the live track to ask it later whether it really stopped.
  const firstTrack = await studio.video().evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getVideoTracks()[0]);
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await expect(page.getByText("Turn on the camera to start taking pictures.")).toBeVisible();
  expect(await firstTrack.evaluate((track) => track.readyState)).toBe("ended");

  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(studio.video()).toBeVisible();
  const secondTrack = await studio.video().evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getVideoTracks()[0]);
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => secondTrack.evaluate((track) => track.readyState)).toBe("ended");
});

test("the capture button waits for the camera's first picture, so no press is lost", async ({ studio, page }) => {
  const canStream = await page.evaluate(() => "captureStream" in HTMLCanvasElement.prototype);
  test.skip(!canStream, "This browser build has no media streams (Playwright's WebKit on Windows).");
  await page.addInitScript(() => {
    // A camera that answers at once but sends its first frame only when the test says so,
    // like a slow USB webcam waking up. (Not a timer: on a busy machine a timer can fire
    // before the test has even looked at the button.)
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      Object.assign(window, { sendFirstFrame: () => setInterval(() => { const c = canvas.getContext("2d")!; c.fillStyle = "#2e8b57"; c.fillRect(0, 0, 320, 240); }, 33) });
      return canvas.captureStream(30);
    };
  });
  // Don't wait for the page's "load" event: Chrome holds it back while a <video> waits for its
  // first frame, and here that frame only comes when the test sends it.
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\?project=/);
  const turnOn = page.getByRole("button", { name: "Turn on camera" });
  await expect(turnOn.or(page.getByRole("button", { name: "Turn camera off" }))).toBeVisible();
  if (await turnOn.isVisible()) await turnOn.click();

  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();   // the camera is on...
  await expect(studio.captureButton()).toBeDisabled();                             // ...but there's no picture yet
  await page.waitForTimeout(500);                                                  // and it stays off while waiting
  await expect(studio.captureButton()).toBeDisabled();
  await page.evaluate(() => (window as unknown as { sendFirstFrame: () => void }).sendFirstFrame());
  await expect(studio.captureButton()).toBeEnabled();
  await studio.captureButton().click();
  await expect(studio.pictures()).toHaveCount(1);
});

test("a blocked camera says so and offers to try again", async ({ studio, page }) => {
  await page.addInitScript(() => {
    // Every request for the camera is refused, as if the user (or a policy) blocked it.
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  });
  await studio.open();

  // With permission already granted the studio tries at once and lands on "blocked" by itself;
  // otherwise it waits for the button. Wait for either, then press the button if it's there.
  const turnOn = page.getByRole("button", { name: "Turn on camera" });
  const blocked = page.getByRole("main", { name: "Stage" }).getByText(/The camera is blocked/);   // the camera box says it too, in short
  await expect(turnOn.or(blocked)).toBeVisible();
  if (await turnOn.isVisible()) await turnOn.click();

  await expect(blocked).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(studio.captureButton()).toBeDisabled();
});

test("the camera stays as it was left after a reload: off stays off, on comes back on @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();   // started by itself
});
