import { readFile, writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const WORKER = "out/sw.js";       // what the test server serves at /sw.js
const HOME = "out/index.html";   // and at /

// Offline (step 32): after one visit the service worker has stored the app, so the home page and
// the studio open, take pictures and save a GIF with no internet at all. Online, every page comes
// fresh from the network, so it's always the latest; only a page opened from the stored copy offers
// Update when a newer version comes.
//
// The worker exists only in the production build (npm run build writes out/sw.js), so these run
// with `npm run test:e2e -- e2e/offline.spec.ts`, not against the dev server. Every other spec
// blocks service workers (playwright.config.ts); these allow them.

test.use({ serviceWorkers: "allow" });
test.skip(({ baseURL }) => !baseURL?.includes(":3200"), "The service worker is only in the production build: npm run test:e2e -- e2e/offline.spec.ts");

// Until the worker has stored the app and runs this page.
async function storedOffline(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30_000 });
}

test("after one visit, the studio opens, takes pictures and saves a GIF without the internet", async ({ projects, studio, page, context }) => {
  await projects.open();
  await storedOffline(page);

  await context.setOffline(true);
  await page.reload();
  await expect(projects.newButton()).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/works without the internet/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await projects.newButton().click();
  await page.waitForURL(/project=/);
  await page.reload();   // the studio's own address, with its ?project=, comes from the stored page too
  await studio.cameraOn();
  await studio.takePictures(2);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save as GIF" }).click();   // its encoder is a worker file, stored too
  expect((await downloading).suggestedFilename()).toMatch(/\.gif$/);
});

// A new deploy while a page is open: the test server serves out/ as it is on disk, so a file
// changed there is the new version; put back afterwards. Service workers are blocked in every other
// spec, so none notices; these two change the same files, so they run one after the other.
async function deployed<T>(file: string, change: (text: string) => string, run: () => Promise<T>): Promise<T> {
  const original = await readFile(file, "utf8");
  try { await writeFile(file, change(original)); return await run(); } finally { await writeFile(file, original); }
}
const newWorker = (text: string) => `${text}
// a new version
`;

// Asks for the new worker and waits until it has taken over this page.
async function takenOver(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    navigator.serviceWorker.getRegistration().then((found) => found?.update());
  }));
}

test.describe("new versions", () => {
  test.describe.configure({ mode: "serial" });
  const notice = (page: Page) => page.getByRole("status").filter({ hasText: "A new version of the studio is ready." });

  test("online, a page is always the latest one, and never asks to update", async ({ projects, page }) => {
    await projects.open();
    await storedOffline(page);

    // A changed home page shows at once, though the old one is stored.
    const marked = await deployed(HOME, (html) => `${html}<!-- a new version -->`, async () => {
      await page.reload();
      return page.evaluate(() => document.lastChild?.nodeType === Node.COMMENT_NODE && document.lastChild.textContent === " a new version ");
    });
    expect(marked).toBe(true);

    // A new worker takes over quietly: this page is already the latest.
    await deployed(WORKER, newWorker, () => takenOver(page));
    await page.waitForTimeout(500);   // the notice would show at once
    await expect(notice(page)).toHaveCount(0);
  });

  test("a page opened without the internet offers Update when a newer version comes, then reloads into it", async ({ projects, page, context }) => {
    await projects.open();
    await storedOffline(page);
    await context.setOffline(true);
    await page.reload();   // from the stored copy
    await expect(projects.newButton()).toBeVisible();
    await expect(notice(page)).toHaveCount(0);

    await context.setOffline(false);
    await deployed(WORKER, newWorker, () => takenOver(page));
    await expect(notice(page)).toBeVisible();

    const reloaded = page.waitForEvent("load");
    await notice(page).getByRole("button", { name: "Update" }).click();
    await reloaded;
    await expect(projects.newButton()).toBeVisible();
    await expect(notice(page)).toHaveCount(0);   // fresh from the network now
  });
});
