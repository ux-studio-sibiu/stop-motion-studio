import { expect, test } from "./fixtures";

// Pictures are saved in the browser (IndexedDB) as they're taken (step 07). Each test runs in
// a fresh browser context, so it starts with an empty database.

test("pictures survive a reload", async ({ studio, page }) => {
  await studio.open();
  await studio.cameraOn();
  await studio.takePictures(3);
  await expect(studio.pictureCount()).toHaveText("3 pictures");

  await page.reload();

  await expect(studio.pictures()).toHaveCount(3);
  await expect(studio.pictureCount()).toHaveText("3 pictures");
  // The thumbnails really came back from storage, not just the pictures' places.
  for (const number of [1, 2, 3]) {
    await expect.poll(() => studio.thumbnailOf(number)).toMatchObject({ type: "image/jpeg" });
  }
});

test("a new project starts empty and doesn't see another project's pictures", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  const first = page.url();

  await studio.open("/studio");
  expect(page.url()).not.toBe(first);
  await expect(studio.pictureCount()).toHaveText("No pictures yet");
  await expect(studio.pictures()).toHaveCount(0);

  await page.goto(first);
  await expect(studio.pictures()).toHaveCount(2);
});

test("going home and pressing Back returns to the same project", async ({ studio, page }) => {
  await studio.open();
  const url = page.url();
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page).toHaveURL(/\/$/);   // wait for the home page, or Back would leave the studio itself
  await page.goBack();
  await expect(page).toHaveURL(url);
});

test("an unknown project shows a friendly page", async ({ page }) => {
  await page.goto("/studio?project=does-not-exist");
  await expect(page.getByRole("heading", { name: "This animation isn't here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new animation" })).toBeVisible();
});

test("after a reload the studio only shows once it's as it was left", async ({ studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);
  await page.getByRole("tab", { name: "Picture" }).click();
  // Notes what's on screen at the moment the studio first becomes visible, before anything paints.
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      const root = document.querySelector(".nsc-studio.is-ready");
      if (!root) return;
      observer.disconnect();
      Object.assign(window, { firstShown: {
        tab: root.querySelector("[role=tab][aria-selected=true]")?.getAttribute("aria-label"),
        pictures: root.querySelectorAll("[role=listbox] [role=option]").length,
      } });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.reload();
  await expect(page.locator(".nsc-studio")).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => (window as unknown as { firstShown: unknown }).firstShown)).toEqual({ tab: "Picture", pictures: 2 });
});
