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
  readonly track = () => this.page.getByRole("listbox", { name: "Pictures" });
  readonly pictures = () => this.page.getByRole("option", { name: /^Picture \d+$/ });
  readonly picture = (number: number) => this.page.getByRole("option", { name: `Picture ${number}`, exact: true });
  readonly cameraToggle = () => this.page.getByRole("button", { name: /^Turn camera (on|off)$/ });
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
    const live = this.page.getByRole("button", { name: "Turn camera off" });
    await expect(turnOn.or(live)).toBeVisible();
    if (await turnOn.isVisible()) await turnOn.click();
    // Starting a camera can take a few seconds when the machine is busy (both browsers running
    // many tests at once), longer than Playwright's default 5 s for an expect.
    await expect(this.captureButton()).toBeEnabled({ timeout: 15_000 });
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

  // For tests that don't need the camera: marks it as turned off (the remembered setting) before
  // the page loads, so the studio never starts it. Starting the fake camera is the slow, flaky
  // part of a test when many browsers run at once; tests about pictures, not the camera, skip it.
  // Call before open().
  async withoutCamera(): Promise<void> {
    await this.page.addInitScript(() => { try { localStorage.setItem("stop-motion-studio:camera-off", "1"); } catch { /* no storage */ } });
  }

  // Turns the ruler's gradations on (the Layers menu's Gradations, off at first), for tests that
  // read the ruler's times: remembered, then the page reloads.
  async showGradations(): Promise<void> {
    await this.page.evaluate(() => localStorage.setItem("stop-motion-studio:timeline-layers", JSON.stringify({ objects: true, sounds: true, ruler: true })));
    await this.page.reload();
    await expect(this.page.locator(".ruler-label").first()).toBeVisible();
  }

  // Puts `count` pictures into the open project without the camera: much faster than taking them,
  // for tests about what happens to pictures, not how they're taken. Each is a small generated
  // JPEG (a different colour each, with a white square), saved straight into the app's IndexedDB
  // in the same shape the app saves them, then the page reloads to read them. Nothing ends up
  // selected, and the undo history is empty, as after any reload.
  // onePhoto: every picture shares one photo (still a picture each), for long animations (step 31),
  // where drawing thousands of JPEGs would take most of the test.
  async seedPictures(count: number, { onePhoto = false }: { onePhoto?: boolean } = {}): Promise<void> {
    const projectId = new URL(this.page.url()).searchParams.get("project");
    if (!projectId) throw new Error("Open the studio before seeding pictures");
    const before = await this.pictures().count();
    await this.page.evaluate(async ({ projectId, count, onePhoto }) => {
      const jpeg = async (width: number, height: number, hue: number) => {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = `hsl(${hue} 70% 45%)`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(width * 0.2, height * 0.3, width * 0.15, height * 0.25);
        return canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
      };
      const request = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const db = await request(indexedDB.open("stop-motion-studio"));
      const project = await request(db.transaction("projects").objectStore("projects").get(projectId));
      const records = [];
      const shared = onePhoto ? { image: await jpeg(1280, 720, 0), thumb: await jpeg(160, 90, 0) } : null;
      for (let i = 0; i < count; i++) {
        const imageId = crypto.randomUUID();
        const hue = (i * 47) % 360;
        records.push({
          frame: { id: crypto.randomUUID(), projectId, imageId, hold: 1, transform: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false }, adjust: { brightness: 1, contrast: 1 } },
          image: { id: imageId, projectId, blob: shared?.image ?? await jpeg(1280, 720, hue), width: 1280, height: 720, createdAt: Date.now() },
          thumb: { imageId, projectId, blob: shared?.thumb ?? await jpeg(160, 90, hue) },
        });
      }
      const tx = db.transaction(["projects", "frames", "images", "thumbs"], "readwrite");
      for (const { frame, image, thumb } of records) {
        tx.objectStore("frames").put(frame);
        tx.objectStore("images").put(image);
        tx.objectStore("thumbs").put(thumb);
      }
      tx.objectStore("projects").put({ ...project, frameIds: [...project.frameIds, ...records.map(({ frame }) => frame.id)], updatedAt: Date.now() });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    }, { projectId, count, onePhoto });
    await this.page.reload();
    await expect(this.pictures()).toHaveCount(before + count);
  }

  readonly undoButton = () => this.page.getByRole("button", { name: "Undo" });
  readonly redoButton = () => this.page.getByRole("button", { name: "Redo" });
  // "Delete picture" or "Delete 3 pictures", depending on the selection; the same for Duplicate.
  readonly deleteButton = () => this.page.getByRole("button", { name: /^Delete (picture|\d+ pictures)$/ });
  readonly duplicateButton = () => this.page.getByRole("button", { name: /^Duplicate (picture|\d+ pictures)$/ });
  readonly selected = () => this.track().getByRole("option", { selected: true });   // in the timeline, not any <select>

  // The resize grip on a selected picture's right edge.
  readonly grip = (number: number) => this.picture(number).locator(".grip");

  // Drags picture n's grip sideways by dx pixels, in small steps like a real hand. Leaves the
  // mouse button down when `release` is false, to look at the drag in progress.
  async dragGrip(number: number, dx: number, { release = true } = {}): Promise<void> {
    const box = await this.grip(number).boundingBox();
    if (!box) throw new Error(`Picture ${number} has no grip (is it selected?)`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y, { steps: 8 });
    if (release) await this.page.mouse.up();
  }

  // Drags picture n by its body (its left part, away from the resize grip) to a point `dx`
  // pixels right of where it was grabbed. Leaves the button down when `release` is false.
  async dragPicture(number: number, dx: number, { release = true } = {}): Promise<void> {
    const box = await this.picture(number).boundingBox();
    if (!box) throw new Error(`Picture ${number} isn't on the timeline`);
    const x = box.x + 4;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y, { steps: 10 });
    if (release) await this.page.mouse.up();
  }

  // The ids of the selected pictures, in timeline order.
  async selectedOrder(): Promise<string[]> {
    return this.selected().evaluateAll((options) => options.map((option) => option.id));
  }

  // Which frames are on the timeline, in order, by their id (pictures are renumbered after
  // a delete, so their names can't tell a picture that came back from a new one).
  async order(): Promise<string[]> {
    return this.pictures().evaluateAll((options) => options.map((option) => option.id));
  }

  pictureCount(): Locator {
    return this.page.locator(".picture-count");
  }

  // Width on screen, in CSS pixels.
  async widthOf(locator: Locator): Promise<number> {
    return (await locator.boundingBox())?.width ?? 0;
  }

  // A picture's thumbnail (once), and inside it the photo (a background image, moved like the
  // picture) and, when it has any, its objects (a canvas).
  readonly thumb = (number: number) => this.picture(number).locator(".thumb");
  readonly thumbPhoto = (number: number) => this.thumb(number).locator(".photo");
  readonly thumbObjects = (number: number) => this.thumb(number).locator("canvas.objects");

  // The colour the stage draws at a point given as fractions of the picture (the middle by
  // default), as [r, g, b].
  async stageColour(x = 0.5, y = 0.5): Promise<number[]> {
    return this.page.locator(".stage-picture").evaluate((canvas: HTMLCanvasElement, at) => [...canvas.getContext("2d")!.getImageData(Math.round(canvas.width * at.x), Math.round(canvas.height * at.y), 1, 1).data.slice(0, 3)], { x, y });
  }

  // A point of a stage layer (the Objects or Draw layer), given as fractions of it, in page pixels.
  async onLayer(layer: Locator, x: number, y: number): Promise<{ x: number; y: number }> {
    const box = (await layer.boundingBox())!;
    return { x: box.x + box.width * x, y: box.y + box.height * y };
  }

  // A drag across a stage layer, between points given as fractions of it.
  async dragOnStage(layer: Locator, from: [number, number], to: [number, number], steps = 20): Promise<void> {
    const start = await this.onLayer(layer, ...from);
    const end = await this.onLayer(layer, ...to);
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await this.page.mouse.move(end.x, end.y, { steps });
    await this.page.mouse.up();
  }

  // Resolves when the picture's thumbnail photo is a real, loaded JPEG.
  async thumbnailOf(number: number): Promise<{ type: string; size: number }> {
    return this.thumbPhoto(number).evaluate(async (element) => {
      const url = getComputedStyle(element).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
      if (!url) return { type: "", size: 0 };
      const blob = await fetch(url).then((response) => response.blob());
      return { type: blob.type, size: blob.size };
    });
  }

  // A sound pill in the Sounds tab (step 29b): a click plays it, a drag adds it.
  readonly soundTile = (name: string) => this.page.locator(".nsc-sounds-panel").getByRole("button", { name, exact: true });

  // Drags a sound from the Sounds tab (opening it) onto the stage, or onto the Sound Layer at a tick.
  // The drag starts first, which shows a hidden Sound Layer, then goes to where it lands.
  async dragSound(name: string, to: "stage" | { tick: number } = "stage"): Promise<void> {
    await this.page.getByRole("tab", { name: "Sounds" }).click();
    await this.soundTile(name).hover();   // waits until the tab is showing and the pill holds still
    const from = (await this.soundTile(name).boundingBox())!;
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2, { steps: 4 });
    const target = to === "stage" ? this.page.locator(".stage-frame") : this.page.getByRole("group", { name: "Sound Layer" });
    const box = (await target.boundingBox())!;
    const x = to === "stage" ? box.x + box.width / 2 : box.x + to.tick * Number(await target.getAttribute("data-tick-width")) + 2;
    await this.page.mouse.move(x, box.y + box.height / 2, { steps: 12 });
    await this.page.mouse.up();
  }
}

// The projects page (home): the list of saved animations.
export class Projects {
  constructor(readonly page: Page) {}

  readonly newButton = () => this.page.getByRole("button", { name: "New animation" });
  readonly cards = () => this.page.locator(".nsc-project-card");
  readonly card = (name: string) => this.cards().filter({ has: this.page.getByRole("button", { name: `Rename ${name}`, exact: true }) });   // its name (a click renames it)

  async open(): Promise<void> {
    await this.page.goto("/");
    await expect(this.page.getByText("Loading your animations…")).toBeHidden();   // the list has answered
  }

  async rename(from: string, to: string): Promise<void> {
    await this.page.getByRole("button", { name: `Rename ${from}` }).click();
    const input = this.page.getByRole("textbox", { name: "Animation name" });
    await input.fill(to);
    await input.press("Enter");
  }
}

export const test = base.extend<StudioOptions & { studio: Studio; projects: Projects }>({
  fakeCamera: ["device", { option: true }],

  studio: async ({ page, fakeCamera }, use) => {
    if (fakeCamera === "script") await page.addInitScript(installScriptCamera);
    await use(new Studio(page, fakeCamera));
  },

  // With reduced motion, as some children's computers are set: the home page's intro (the title,
  // its burst, the buttons, the animations sliding in, a frame each) is simply there, so a test can press
  // New at once. The title's own test turns the motion back on.
  projects: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await use(new Projects(page));
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
