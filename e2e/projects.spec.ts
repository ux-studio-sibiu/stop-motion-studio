import { expect, test } from "./fixtures";

// The projects page (step 09): list, create, open, rename, delete. Each test starts with an
// empty browser profile, so with no animations at all.

test("with no animations, the page says how to start", async ({ projects, page }) => {
  await projects.open();
  await expect(page.getByText(/No animations yet/)).toBeVisible();
  await expect(projects.cards()).toHaveCount(0);
});

test("New animation opens the studio, and the animation is listed afterwards", async ({ projects, page }) => {
  await projects.open();
  await projects.newButton().click();
  await expect(page).toHaveURL(/\/studio\?project=/);

  await page.getByRole("link", { name: "All projects" }).click();
  await expect(projects.card("My animation")).toBeVisible();
  await expect(projects.card("My animation")).toContainText("0 pictures");
});

test("a card shows its first picture and how many there are", async ({ projects, studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);

  await page.getByRole("link", { name: "All projects" }).click();
  const card = projects.card("My animation");
  await expect(card).toContainText("2 pictures");
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);

  await card.getByRole("link", { name: "Open My animation" }).click();
  await expect(studio.pictures()).toHaveCount(2);
});

test("renaming keeps the new name after a reload, and blank names fall back", async ({ projects, page }) => {
  await projects.open();
  await projects.newButton().click();
  await page.getByRole("link", { name: "All projects" }).click();

  await projects.rename("My animation", "  Dino   walk ");
  await expect(projects.card("Dino walk")).toBeVisible();
  await page.reload();
  await expect(projects.card("Dino walk")).toBeVisible();

  await projects.rename("Dino walk", "   ");
  await expect(projects.card("My animation")).toBeVisible();
});

test("Escape cancels a rename", async ({ projects, page }) => {
  await projects.open();
  await projects.newButton().click();
  await page.getByRole("link", { name: "All projects" }).click();

  await page.getByRole("button", { name: "Rename My animation" }).click();
  await page.getByRole("textbox", { name: "Animation name" }).fill("Oops");
  await page.getByRole("textbox", { name: "Animation name" }).press("Escape");
  await expect(projects.card("My animation")).toBeVisible();
  await expect(projects.card("Oops")).toHaveCount(0);
});

test("deleting asks first; Keep it keeps, Delete deletes for good", async ({ projects, page }) => {
  await projects.open();
  await projects.newButton().click();
  await page.getByRole("link", { name: "All projects" }).click();

  const dialog = page.getByRole("dialog", { name: /Delete .My animation./ });
  await page.getByRole("button", { name: "Delete My animation" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();   // the safe answer is the default
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  await expect(projects.cards()).toHaveCount(1);

  await page.getByRole("button", { name: "Delete My animation" }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(projects.cards()).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/No animations yet/)).toBeVisible();
});

test("the storage meter says how much space is used", async ({ projects, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Only Chromium reports a storage estimate reliably in Playwright.");
  await projects.open();
  await expect(page.getByRole("region", { name: "Storage on this device" })).toContainText(/Using .+ of about .+ on this device/);
});

test("deleting an animation forgets everything remembered about it, and nothing about the others", async ({ projects, page }) => {
  await projects.open();
  await projects.newButton().click();
  await page.waitForURL(/project=/);
  const id = new URL(page.url()).searchParams.get("project")!;
  // What the studio remembers per animation (remembered.ts), for this one and for another.
  const families = ["view", "selection", "stage-view", "overlay-selection"];
  await page.evaluate(({ id, families }) => {
    for (const family of families) {
      localStorage.setItem(`stop-motion-studio:${family}:${id}`, JSON.stringify("x"));
      localStorage.setItem(`stop-motion-studio:${family}:another`, JSON.stringify("x"));
    }
  }, { id, families });
  await page.getByRole("link", { name: "All projects" }).click();
  await page.getByRole("button", { name: "Delete My animation" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(projects.cards()).toHaveCount(0);

  const left = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("stop-motion-studio:")).sort());
  expect(left.filter((key) => key.endsWith(`:${id}`))).toEqual([]);
  expect(left.filter((key) => key.endsWith(":another"))).toHaveLength(families.length);
});

// Backup and restore (step 27): a .zip of the animation, restored as a new animation.
test("a backup brings an animation back after it's deleted: its pictures, their order and lengths", async ({ projects, studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(3);
  await studio.picture(2).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("]");   // picture 2 lasts 4 ticks
  const widths = async () => Promise.all([1, 2, 3].map((n) => studio.widthOf(studio.picture(n))));
  const before = await widths();

  await page.getByRole("link", { name: "All projects" }).click();
  const downloading = page.waitForEvent("download");
  await projects.card("My animation").getByRole("button", { name: "Back up My animation" }).click();
  const backup = await downloading;
  expect(backup.suggestedFilename()).toBe("My animation.zip");
  await expect(page.getByRole("status").filter({ hasText: "Saved a backup of My animation" })).toBeVisible();

  await page.getByRole("button", { name: "Delete My animation" }).click();
  await page.getByRole("dialog", { name: /Delete .My animation./ }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(projects.cards()).toHaveCount(0);

  await page.getByLabel("Backup file").setInputFiles((await backup.path())!);
  await expect(page.getByRole("status").filter({ hasText: "Restored My animation" })).toBeVisible();
  const card = projects.card("My animation");
  await expect(card).toContainText("3 pictures");
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);   // its thumbnail, made anew

  await card.getByRole("link", { name: "Open My animation" }).click();
  await expect(studio.pictures()).toHaveCount(3);
  await expect.poll(widths).toEqual(before);   // the same lengths, in the same order
});

test("restoring a file that isn't a backup says so, and adds nothing", async ({ projects, page }) => {
  await projects.open();
  await page.getByLabel("Backup file").setInputFiles({ name: "holiday.zip", mimeType: "application/zip", buffer: Buffer.from("not really a zip") });
  await expect(page.getByRole("status").filter({ hasText: "That file isn't a backup of an animation." })).toBeVisible();
  await expect(projects.cards()).toHaveCount(0);
});
