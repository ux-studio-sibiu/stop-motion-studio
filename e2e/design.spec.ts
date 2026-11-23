import { expect, test } from "@playwright/test";

// The design system page (Part 8b): a utility page, so one check only (the user's call): it renders
// every section without errors. What the specimens look like is checked by eye.

test("the design system page shows every section, with no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/design");
  for (const name of ["Tokens", "Words", "Controls", "Side panel", "Objects", "Stage", "Timeline", "Bars and menus", "Projects"]) {
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");   // the real side panel
  expect(errors).toEqual([]);
});

test("a token changed in the panel restyles the page, not the panel; reset puts it back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design");
  const panel = page.getByRole("dialog", { name: "Design tokens" });
  const border = () => page.locator("#bars .toolbar .icon-button").first().evaluate((element) => getComputedStyle(element).borderTopColor);
  const panelBorder = () => panel.evaluate((element) => getComputedStyle(element).borderTopColor);
  await expect.poll(border).toBe("rgb(51, 51, 51)");
  const before = await panelBorder();

  await panel.getByRole("textbox", { name: "--color-border", exact: true }).fill("#ff0000");
  await expect.poll(border).toBe("rgb(255, 0, 0)");
  expect(await panelBorder()).toBe(before);
  await expect(panel.getByText("1 changed")).toBeVisible();

  await panel.getByRole("button", { name: "Reset --color-border" }).click();
  await expect.poll(border).toBe("rgb(51, 51, 51)");
});

test("Alt+click copies a colour token, Ctrl+Alt+click pastes it on another, as a tweak", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design");
  const panel = page.getByRole("dialog", { name: "Design tokens" });
  const border = () => page.locator("#bars .toolbar .icon-button").first().evaluate((element) => getComputedStyle(element).borderTopColor);
  const ink = page.locator('[data-colour-token="--color-ink"]');
  const borderToken = page.locator('[data-colour-token="--color-border"]');

  await borderToken.click({ modifiers: ["Control", "Alt"] });   // nothing copied yet
  await expect(page.getByRole("status").filter({ hasText: "Nothing copied yet" })).toBeVisible();
  await ink.click({ modifiers: ["Alt"] });
  await borderToken.click({ modifiers: ["Control", "Alt"] });
  await expect.poll(border).toBe("rgb(31, 36, 51)");   // --color-ink, #1f2433
  await expect(panel.getByRole("textbox", { name: "--color-border", exact: true })).toHaveValue("#1f2433");
  await expect(panel.getByText("1 changed")).toBeVisible();
});

test("picking an element lists only the tokens it uses", async ({ page }) => {
  await page.goto("/design");
  const panel = page.getByRole("dialog", { name: "Design tokens" });
  const row = (name: string) => panel.getByRole("textbox", { name, exact: true }).or(panel.getByRole("spinbutton", { name, exact: true }));
  await panel.getByRole("button", { name: "Pick" }).click();
  await page.locator("#bars .toolbar .icon-button").first().click();   // the toolbar's back button
  await expect(panel.getByText(/Tokens of a\.icon-button/)).toBeVisible();
  for (const name of ["--color-border", "--radius-small", "--color-surface", "--line-width"]) await expect(row(name)).toBeVisible();
  await expect(row("--color-scrim")).toHaveCount(0);   // photo labels: nothing to do with buttons
  await panel.getByRole("button", { name: "Show all tokens" }).click();
  await expect(row("--color-scrim")).toBeVisible();
});

test("tweaks are kept after a reload until Reset all; Copy changes gives them as a message", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design");
  const panel = page.getByRole("dialog", { name: "Design tokens" });
  await panel.getByRole("textbox", { name: "--color-border", exact: true }).fill("#9d927f");

  await page.reload();
  await expect(panel.getByRole("textbox", { name: "--color-border", exact: true })).toHaveValue("#9d927f");
  await expect(panel.getByText("1 changed")).toBeVisible();

  await panel.getByRole("button", { name: "Copy changes" }).click();
  await expect(panel.getByRole("status")).toHaveText(/Copied 1 change/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("- --color-border (light): #333333 -> #9d927f");

  page.once("dialog", (dialog) => void dialog.accept());
  await panel.getByRole("button", { name: "Reset all" }).click();
  await expect(panel.getByRole("textbox", { name: "--color-border", exact: true })).toHaveValue("#333333");
  await page.reload();
  await expect(panel.getByRole("button", { name: "Copy changes" })).toBeDisabled();
});
