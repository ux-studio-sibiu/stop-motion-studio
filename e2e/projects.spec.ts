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
