import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Adding photos from the computer (step 28): the Add photos button in the timeline's tools, and photos
// dropped on the studio. They go after the selected picture, in name order, and one undo takes
// them all back.

type Photo = { name: string; width: number; height: number; type?: string };

// Makes picture files in the page (a canvas each), as a person's photos would be.
async function photoFiles(page: Page, photos: Photo[]) {
  const encoded = await page.evaluate(async (photos) => Promise.all(photos.map(async ({ width, height, type = "image/jpeg" }, i) => {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `hsl(${i * 37} 70% 50%)`;
    ctx.fillRect(0, 0, width, height);
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.8 })).arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  })), photos);
  return photos.map(({ name, type = "image/jpeg" }, i) => ({ name, mimeType: type, buffer: Buffer.from(encoded[i], "base64") }));
}

// The sizes of the stored pictures, in the animation's order.
async function storedSizes(page: Page): Promise<string[]> {
  const projectId = new URL(page.url()).searchParams.get("project");
  return page.evaluate(async (projectId) => {
    const request = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const db = await request(indexedDB.open("stop-motion-studio"));
    const tx = db.transaction(["projects", "frames", "images"]);
    const project = await request(tx.objectStore("projects").get(projectId!));
    const sizes = [];
    for (const id of project.frameIds) {
      const frame = await request(tx.objectStore("frames").get(id));
      const image = await request(tx.objectStore("images").get(frame.imageId));
      sizes.push(`${image.width}x${image.height}`);
    }
    db.close();
    return sizes;
  }, projectId);
}

test("Add photos puts 10 photos of mixed sizes after the selected picture, and one undo takes them back", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  await studio.picture(1).click();

  const sizes = [[4032, 3024], [3024, 4032], [3840, 2160], [640, 480], [1280, 720], [2000, 1000], [800, 1200], [1920, 1080], [300, 300], [5000, 2000]];
  // Named so that name order isn't the order they're picked in: IMG_2 goes before IMG_10.
  const files = await photoFiles(page, sizes.map(([width, height], i) => ({ name: `IMG_${[10, 2, 3, 4, 5, 6, 7, 8, 9, 1][i]}.jpg`, width, height, type: i === 4 ? "image/png" : "image/jpeg" })));
  await page.getByLabel("Photos to add").setInputFiles([...files, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") }]);

  await expect(page.getByRole("status").filter({ hasText: "Added 10 photos. 1 file wasn't a photo." })).toBeVisible();
  await expect(studio.pictures()).toHaveCount(12);
  await expect(studio.selected()).toHaveCount(10);
  // After picture 1, in name order (IMG_1 … IMG_10), each its own shape fitted inside 1280 x 720.
  await expect.poll(() => storedSizes(page)).toEqual(["1280x720", "1280x512", "540x720", "1280x720", "640x480", "1280x720", "1280x640", "480x720", "1280x720", "300x300", "960x720", "1280x720"]);

  await studio.undoButton().click();
  await expect(studio.pictures()).toHaveCount(2);
  await studio.redoButton().click();
  await expect(studio.pictures()).toHaveCount(12);
});

test("photos dropped on the studio are added; a file that can't be opened says why", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  const [photo] = await photoFiles(page, [{ name: "dino.jpg", width: 1600, height: 900 }]);
  await page.evaluate(({ data }) => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    transfer.items.add(new File([bytes], "dino.jpg", { type: "image/jpeg" }));
    transfer.items.add(new File(["not really a photo"], "IMG_1.HEIC", { type: "image/heic" }));
    const target = document.querySelector(".timeline")!;
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { data: photo.buffer.toString("base64") });

  await expect(page.getByRole("status").filter({ hasText: "Added 1 photo. 1 photo from an iPhone (HEIC) can't be opened in this browser" })).toBeVisible();
  await expect(studio.pictures()).toHaveCount(1);
  await expect.poll(() => storedSizes(page)).toEqual(["1280x720"]);
});
