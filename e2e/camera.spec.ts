import { expect, test } from "./fixtures";

// Tagged @real-camera: these need the browser's own fake webcam (Chromium only, see
// playwright.config.ts). The blocked-camera test fakes the error itself, so it runs everywhere.

test("the camera turns on and shows a live picture @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();

  await expect(studio.video()).toBeVisible();
  // The fake webcam plays a 320x240 video: frames are really arriving.
  await expect.poll(() => studio.video().evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(320);
  await expect(page.getByRole("button", { name: "Camera off" })).toBeVisible();
});

test("turning the camera off stops it, and so does leaving the studio @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();

  // Keep a handle on the live track to ask it later whether it really stopped.
  const firstTrack = await studio.video().evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getVideoTracks()[0]);
  await page.getByRole("button", { name: "Camera off" }).click();
  await expect(page.getByText("Turn on the camera to start taking pictures.")).toBeVisible();
  expect(await firstTrack.evaluate((track) => track.readyState)).toBe("ended");

  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(studio.video()).toBeVisible();
  const secondTrack = await studio.video().evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getVideoTracks()[0]);
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => secondTrack.evaluate((track) => track.readyState)).toBe("ended");
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
  const blocked = page.getByText(/The camera is blocked/);
  await expect(turnOn.or(blocked)).toBeVisible();
  if (await turnOn.isVisible()) await turnOn.click();

  await expect(blocked).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(studio.captureButton()).toBeDisabled();
});
