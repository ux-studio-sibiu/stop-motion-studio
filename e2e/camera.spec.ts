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

test("Tab takes a picture while the camera is on (a wireless presenter's button); Shift+Tab doesn't", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.captureButton().focus();
  await expect(studio.captureButton()).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(studio.pictures()).toHaveCount(1);
  await expect(studio.captureButton()).toBeFocused();   // the focus didn't move on
  await page.keyboard.press("Tab");
  await expect(studio.pictures()).toHaveCount(2);
  await page.keyboard.press("Shift+Tab");               // still moves the focus, takes nothing
  await expect(studio.captureButton()).not.toBeFocused();
  await expect(studio.pictures()).toHaveCount(2);
});

test("Tab from another tab, or with the camera off, opens the Camera tab, turns the camera on and takes a picture", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(1);
  await studio.picture(1).click();   // the Picture tab: the camera goes off
  await expect(page.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Turn camera off" })).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("tab", { name: "Camera" })).toHaveAttribute("aria-selected", "true");
  await expect(studio.pictures()).toHaveCount(2, { timeout: 15_000 });   // once the camera shows a picture
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();

  // In the Camera tab with the camera turned off: Tab turns it back on and takes one.
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await expect(page.getByRole("button", { name: "Turn camera off" })).toHaveCount(0);
  await page.locator("body").focus();
  await page.keyboard.press("Tab");
  await expect(studio.pictures()).toHaveCount(3, { timeout: 15_000 });
});

test("the Camera tab zooms in and moves the frame, per animation; a camera that can't lock says so", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  const zoom = page.getByRole("slider", { name: /Zoom/ });
  const right = page.getByRole("button", { name: "Move the frame right" });
  const transform = () => studio.video().evaluate((video) => getComputedStyle(video).transform);

  await expect(zoom).toHaveValue("1");
  await expect(right).toBeDisabled();   // nothing to move at no zoom
  await zoom.fill("2");
  await expect(page.getByText("Zoom: 2.0×")).toBeVisible();
  await expect.poll(transform).toMatch(/^matrix\(2, 0, 0, 2,/);   // the live picture, scaled
  await right.click();
  await expect(page.getByRole("button", { name: "Centre the frame" })).toBeEnabled();
  const moved = await transform();

  await studio.takePictures(1);   // a picture still comes, framed

  // The test camera can't lock its settings: a note instead of the switch.
  await expect(page.getByText("This camera can't lock its settings")).toBeVisible();

  // Kept for this animation after a reload.
  await page.reload();
  await expect(studio.captureButton()).toBeEnabled({ timeout: 15_000 });   // it was on: it comes back on by itself
  await expect(zoom).toHaveValue("2");
  await expect.poll(transform).toBe(moved);
});

test("with a laptop camera and a plugged-in one, the plugged-in one is used; the arrow picks another", async ({ studio, page }) => {
  const canStream = await page.evaluate(() => "captureStream" in HTMLCanvasElement.prototype);
  test.skip(!canStream, "This browser build has no media streams (Playwright's WebKit on Windows).");
  await page.addInitScript(() => {
    // Two cameras; each stream says which one it is, like a real track's settings.
    const asked: (string | null)[] = [];
    (window as unknown as { asked: typeof asked }).asked = asked;
    const getUserMedia = async (constraints: MediaStreamConstraints) => {
      const wanted = ((constraints.video as MediaTrackConstraints).deviceId as { exact?: string } | undefined)?.exact ?? null;
      asked.push(wanted);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d")!;
      setInterval(() => { context.fillStyle = "#2e8b57"; context.fillRect(0, 0, 320, 240); }, 33);
      const stream = canvas.captureStream(30);
      const track = stream.getVideoTracks()[0];
      const deviceId = wanted ?? "laptop";   // the browser's own pick: the laptop's camera
      track.getSettings = () => ({ deviceId });
      return stream;
    };
    const devices = [{ kind: "videoinput", deviceId: "laptop", label: "Integrated Camera", groupId: "" }, { kind: "videoinput", deviceId: "usb", label: "HD Pro Webcam C920", groupId: "" }];
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia, enumerateDevices: async () => devices, addEventListener: () => {}, removeEventListener: () => {} }, configurable: true });
  });
  await studio.withoutCamera();
  await studio.open();
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([null, "usb"]);   // switched to the plugged-in one

  await page.getByRole("button", { name: "Choose a camera" }).click();
  const cameras = page.getByRole("group", { name: "Cameras" });
  await expect(cameras.getByRole("button", { name: "HD Pro Webcam C920" })).toHaveAttribute("aria-pressed", "true");
  await cameras.getByRole("button", { name: "Integrated Camera" }).click();
  await expect(cameras).toHaveCount(0);   // picking closes the list
  await expect.poll(() => page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([null, "usb", "laptop"]);
  await page.getByRole("button", { name: "Choose a camera" }).click();
  await expect(cameras.getByRole("button", { name: "Integrated Camera" })).toHaveAttribute("aria-pressed", "true");   // the child's pick stays
});

test("the camera is on in the Camera tab only: going to it turns it on, leaving it turns it off @real-camera", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();   // off after loading, as it was left
  await page.getByRole("tab", { name: "Picture" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible({ timeout: 15_000 });
  await expect(studio.captureButton()).toBeEnabled({ timeout: 15_000 });

  const track = await studio.video().evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getVideoTracks()[0]);
  await page.getByRole("tab", { name: "Draw" }).click();
  await expect(studio.video()).toHaveCount(0);
  await expect.poll(() => track.evaluate((t) => t.readyState)).toBe("ended");   // really off: the camera light goes out
  await page.getByRole("tab", { name: "Camera" }).click();
  await expect(studio.video()).toBeVisible({ timeout: 15_000 });
});

test("a reload in another tab leaves the camera off, even when it was on and allowed @real-camera", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await page.getByRole("tab", { name: "Draw" }).click();   // remembered: the reload comes back here
  await expect(studio.video()).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Draw" })).toHaveAttribute("aria-selected", "true");
  await expect(studio.video()).toHaveCount(0);
  await page.getByRole("tab", { name: "Camera" }).click();
  await expect(studio.video()).toBeVisible({ timeout: 15_000 });
});

// The capture sound (step 29): on at first, a click confirms each picture; it can be turned off,
// and stays as it was left. (What's heard is checked in sound.browser.test.ts.)
test("the capture sound plays for each picture, can be turned off, and is remembered @real-camera", async ({ studio, page }) => {
  await page.addInitScript(() => {
    // Counts the sounds started, instead of listening to the speakers.
    const start = OscillatorNode.prototype.start;
    Object.assign(window, { soundsPlayed: 0 });
    OscillatorNode.prototype.start = function (...args) { (window as unknown as { soundsPlayed: number }).soundsPlayed++; return start.apply(this, args); };
  });
  const played = () => page.evaluate(() => (window as unknown as { soundsPlayed: number }).soundsPlayed);
  await studio.open();
  await studio.cameraOn();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await expect(sound).toHaveAttribute("aria-pressed", "true");

  await studio.takePictures(1);
  await expect.poll(played).toBeGreaterThan(0);

  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  const before = await played();
  await studio.takePictures(1);
  await page.waitForTimeout(300);
  expect(await played()).toBe(before);   // off: no click

  await page.reload();
  await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveAttribute("aria-pressed", "false");
});
