import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Storage safety (step 21): photos of deleted pictures are cleaned up once no undo can need them,
// a full device gets a message instead of a silent failure, and past 80% the studio and the
// projects page warn.

// How many photos are stored, straight from the app's IndexedDB.
const storedImages = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open("stop-motion-studio"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  const count = await new Promise<number>((resolve, reject) => { const request = db.transaction("images").objectStore("images").count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  db.close();
  return count;
});

test.beforeEach(async ({ studio }) => {
  await studio.withoutCamera();
});

test("a deleted picture's photo stays for undo, and is cleaned up once the animation is left", async ({ studio, page }) => {
  await studio.open();
  await studio.seedPictures(3);
  const url = page.url();
  await studio.picture(2).click();
  await studio.deleteButton().click();
  await expect(studio.pictures()).toHaveCount(2);
  expect(await storedImages(page)).toBe(3);   // undo still needs it

  await studio.undoButton().click();
  await expect(studio.pictures()).toHaveCount(3);
  await expect.poll(() => studio.thumbnailOf(2)).toMatchObject({ type: "image/jpeg" });   // back, with its picture

  await studio.picture(2).click();
  await studio.deleteButton().click();
  await expect(studio.pictures()).toHaveCount(2);
  await page.getByRole("link", { name: "All projects" }).click();   // leaving: no undo left
  await expect.poll(() => storedImages(page)).toBe(2);
  await page.goto(url);
  await expect(studio.pictures()).toHaveCount(2);
});

test("when the device is full, the studio says so instead of silently losing the change", async ({ studio, page }) => {
  // From when the page sets __storageFull, every write to storage fails the way a full disk does.
  await page.addInitScript(() => {
    for (const name of ["put", "add"] as const) {
      const original = IDBObjectStore.prototype[name];
      IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
        if ((window as unknown as { __storageFull?: boolean }).__storageFull) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        return original.apply(this, args);
      } as typeof original;
    }
  });
  await studio.open();
  await studio.seedPictures(1);
  await page.evaluate(() => { (window as unknown as { __storageFull: boolean }).__storageFull = true; });

  await studio.picture(1).click();
  await studio.duplicateButton().click();
  const alert = page.getByRole("alert").filter({ hasText: "no room left" });   // Next has its own (empty) alert for route changes
  await expect(alert).toContainText("There's no room left on this device");
  await expect(studio.pictures()).toHaveCount(1);   // nothing half-saved
  await alert.getByRole("button", { name: "Close message" }).click();
  await expect(alert).toHaveCount(0);
});

test("past 80% full, the studio and the projects page warn, and each card says how much space it takes", async ({ studio, page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(StorageManager.prototype, "estimate", { value: async () => ({ usage: 850_000_000, quota: 1_000_000_000 }) });
  });
  await studio.open();
  await studio.seedPictures(2);
  await expect(page.getByRole("status").filter({ hasText: "This device is almost full" })).toBeVisible();
  await page.getByRole("button", { name: "Close message" }).click();
  await expect(page.getByText("This device is almost full")).toHaveCount(0);

  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page.getByText("Almost full.")).toBeVisible();
  await expect(page.locator(".nsc-project-card .size").first()).toHaveText(/^\d+(\.\d)? (B|KB|MB)$/);
});
