import { test as base, expect, type Locator, type Page } from "@playwright/test";

// How a project gets a webcam:
//   "device": the browser's own fake camera (Chromium flags in playwright.config.ts), so the
//             real getUserMedia path runs end to end
//   "script": getUserMedia is replaced before the page loads with a canvas stream, for
//             browsers without a fake device (WebKit)
export type StudioOptions = { fakeCamera: "device" | "script" };

// A page object for the studio: the things a test does, named the way a child would say
// them. Tests read like the flow they check, and when the UI changes, only this file changes.
export class Studio {
  constructor(readonly page: Page, private readonly fakeCamera: StudioOptions["fakeCamera"]) {}

  readonly captureButton = () => this.page.getByRole("button", { name: "Take a picture" });
  readonly pictures = () => this.page.getByRole("button", { name: /^Picture \d+$/ });
  readonly cameraToggle = () => this.page.getByRole("button", { name: /^Camera (on|off)$/ });
  readonly video = () => this.page.locator("video");

  async open(path = "/studio"): Promise<void> {
    await this.page.goto(path);
    await expect(this.page).toHaveURL(/\?project=/);   // a project exists and its id is in the address
  }

  // The camera starts by itself when permission is already granted; otherwise press the button.
  // Wait until the studio has settled into one of the two before deciding: checking straight
  // after loading would find neither yet, skip the button and leave the camera off.
  async cameraOn(): Promise<void> {
    // The script camera is a canvas stream. Some browser builds have no media streams at all
    // (Playwright's WebKit on Windows): there the test is skipped, with the reason in the report.
    if (this.fakeCamera === "script") {
      const canStream = await this.page.evaluate(() => "captureStream" in HTMLCanvasElement.prototype);
      test.skip(!canStream, "This browser build has no media streams, so no camera can be faked (Playwright's WebKit on Windows).");
    }
    const turnOn = this.page.getByRole("button", { name: "Turn on camera" });
    const live = this.page.getByRole("button", { name: "Camera off" });
    await expect(turnOn.or(live)).toBeVisible();
    if (await turnOn.isVisible()) await turnOn.click();
    await expect(this.captureButton()).toBeEnabled();
  }

  // One picture at a time: each press waits for its thumbnail, because presses while the
  // previous picture is saving are ignored on purpose.
  async takePictures(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const before = await this.pictures().count();
      await this.captureButton().click();
      await expect(this.pictures()).toHaveCount(before + 1);
    }
  }

  pictureCount(): Locator {
    return this.page.locator(".picture-count");
  }
}

export const test = base.extend<StudioOptions & { studio: Studio }>({
  fakeCamera: ["device", { option: true }],

  studio: async ({ page, fakeCamera }, use) => {
    if (fakeCamera === "script") await page.addInitScript(installScriptCamera);
    await use(new Studio(page, fakeCamera));
  },
});

export { expect };

// Runs inside the page, before its own scripts. Must be self-contained (it's serialised).
function installScriptCamera(): void {
  const getUserMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    let x = 0;
    setInterval(() => {
      context.fillStyle = "#2e8b57";
      context.fillRect(0, 0, 320, 240);
      context.fillStyle = "#fff";
      context.fillRect((x = (x + 6) % 272), 96, 48, 48);
    }, 33);
    return canvas.captureStream(30);
  };
  const mediaDevices = {
    getUserMedia,
    enumerateDevices: async () => [{ kind: "videoinput", deviceId: "script-camera", label: "Script camera", groupId: "" }],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
}
