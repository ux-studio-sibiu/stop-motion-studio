import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { expect, test, type Projects, type Studio } from "./fixtures";

// A new animation with one picture (one without pictures isn't kept), then back home. Returns its id.
async function newAnimationWithAPicture(projects: Projects, studio: Studio, page: Page): Promise<string> {
  await studio.withoutCamera();
  await projects.open();
  await projects.newButton().click();
  await page.waitForURL(/project=/);
  await studio.seedPictures(1);
  const id = new URL(page.url()).searchParams.get("project")!;
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(projects.card("My animation")).toBeVisible();
  return id;
}

// The projects page (step 09): list, create, open, rename, delete. Each test starts with an
// empty browser profile, so with no animations at all.

test("with no animations, the page says how to start", async ({ projects, page }) => {
  await projects.open();
  await expect(page.getByText(/No animations yet/)).toBeVisible();
  await expect(projects.cards()).toHaveCount(0);
});

test("the intro puts down the title card by card, its burst a piece at a time, then the buttons; a click takes them all away at once and plays it again", async ({ projects, page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });   // the intro plays (the fixture turns it off)
  await projects.open();
  await expect(page.getByRole("heading", { level: 1, name: /Stop motion start/ })).toBeVisible();
  const cards = page.locator(".title [data-shown]");          // S T (pause) P, M O T I O N, S T A R T
  const down = page.locator('.title [data-shown="true"]');
  const pieces = page.locator(".title-burst .burst-piece");    // the burst's pieces, drawn as they're put down
  const settings = page.getByRole("button", { name: "Settings" });
  const played = { timeout: 15_000 };                         // the whole intro: a frame each, 100 ms apart
  await expect(cards).toHaveCount(15);
  // The buttons come after the cards and the burst: hidden while those are put down.
  await expect(settings).toBeHidden();
  await expect(down).toHaveCount(15, played);
  await expect(pieces).toHaveCount(5, played);
  await expect(settings).toBeVisible(played);

  // A click: everything gone at once (no playing it backwards), then the intro again. Every frame
  // after the click, how many cards are down: straight from all to none, then only ever more.
  const counts = await page.getByRole("button", { name: "Play the title again" }).evaluate((button: HTMLButtonElement) => {
    const seen: number[] = [];
    button.click();
    return new Promise<number[]>((resolve) => {
      const look = () => {
        seen.push(button.querySelectorAll('[data-shown="true"]').length);
        if (seen.length < 40 && seen.at(-1) !== 15) requestAnimationFrame(look); else resolve(seen);
      };
      requestAnimationFrame(look);
    });
  });
  const firstDrop = counts.findIndex((count) => count < 15);
  expect(counts[firstDrop]).toBe(0);                                                  // none left, at once
  expect(counts.slice(firstDrop).every((count, i, all) => i === 0 || count >= all[i - 1])).toBe(true);   // then put down again, never taken away
  await expect(settings).toBeHidden();
  await expect(down).toHaveCount(15, played);    // and put down again
  await expect(pieces).toHaveCount(5, played);
  await expect(settings).toBeVisible(played);
});

test("New animation opens the studio; it's listed once it has a picture, and an empty one isn't kept", async ({ projects, studio, page }) => {
  await studio.withoutCamera();
  await projects.open();
  await projects.newButton().click();
  await expect(page).toHaveURL(/\/studio\?project=/);
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page.getByText(/No animations yet/)).toBeVisible();   // no pictures: thrown away
  await expect(projects.cards()).toHaveCount(0);

  await projects.newButton().click();
  await expect(page).toHaveURL(/\/studio\?project=/);
  await studio.seedPictures(1);
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(projects.card("My animation")).toBeVisible();
  await expect(projects.card("My animation").locator(".picture-count")).toHaveText("1 picture");
});

test("a card shows its first picture and how many there are", async ({ projects, studio, page }) => {
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(2);

  await page.getByRole("link", { name: "All projects" }).click();
  const card = projects.card("My animation");
  // How many: beside the buttons, all the time (not in the details line).
  const count = card.locator(".picture-count");
  await expect(count).toHaveText("2 pictures");
  await expect(card.locator(".meta")).not.toContainText("pictures");
  await page.mouse.move(0, 0);
  await expect(count).toBeVisible();
  // Under the pointer, the card is picked up like the buttons: lifted and tilted, at once.
  const turn = () => card.evaluate((element) => getComputedStyle(element).rotate);
  expect(await turn()).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });   // the lift is off with reduced motion (the fixture's)
  await card.hover();
  expect(await turn()).toBe("-1deg");
  await expect(count).toBeVisible();
  // Drawn sharp from the first picture, only what's inside the safe zone (1208 × 680 of 1280 × 720), 640 wide.
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.complete && [img.naturalWidth, img.naturalHeight].join("x"))).toBe("640x360");

  await card.getByRole("link", { name: "Open My animation" }).click();
  await expect(studio.pictures()).toHaveCount(2);
});

test("renaming keeps the new name after a reload, and blank names fall back", async ({ projects, studio, page }) => {
  await newAnimationWithAPicture(projects, studio, page);

  await projects.rename("My animation", "  Dino   walk ");
  await expect(projects.card("Dino walk")).toBeVisible();
  await page.reload();
  await expect(projects.card("Dino walk")).toBeVisible();

  await projects.rename("Dino walk", "   ");
  await expect(projects.card("My animation")).toBeVisible();
});

test("Escape cancels a rename", async ({ projects, studio, page }) => {
  await newAnimationWithAPicture(projects, studio, page);

  // The name itself is what's clicked (no separate rename button); the card keeps its size.
  const card = projects.card("My animation");
  await expect(card.getByRole("button", { name: "Rename My animation" })).toHaveText("My animation");
  await expect(card.getByRole("button")).toHaveCount(3);   // the name, back up, delete
  const before = await card.boundingBox();
  await page.getByRole("button", { name: "Rename My animation" }).click();
  await expect(page.getByRole("textbox", { name: "Animation name" })).toBeFocused();
  // The cursor at the end of the name, nothing selected.
  expect(await page.getByRole("textbox", { name: "Animation name" }).evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([12, 12]);
  const during = await projects.cards().first().boundingBox();
  expect([during?.width, during?.height]).toEqual([before?.width, before?.height]);
  await page.getByRole("textbox", { name: "Animation name" }).fill("Oops");
  await page.getByRole("textbox", { name: "Animation name" }).press("Escape");
  await expect(projects.card("My animation")).toBeVisible();
  await expect(projects.card("Oops")).toHaveCount(0);
});

test("deleting asks first; Keep it keeps, Delete deletes for good", async ({ projects, studio, page }) => {
  await newAnimationWithAPicture(projects, studio, page);

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

test("Settings shows how much space is used, in a window that its X and Escape shut", async ({ projects, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Only Chromium reports a storage estimate reliably in Playwright.");
  await projects.open();
  await expect(page.getByText(/Using .+ of about .+ on this device/)).toHaveCount(0);   // not on the page itself
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog.getByRole("region", { name: "Storage on this device" })).toContainText(/Using .+ of about .+ on this device/);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("deleting an animation forgets everything remembered about it, and nothing about the others", async ({ projects, studio, page }) => {
  const id = await newAnimationWithAPicture(projects, studio, page);
  // What the studio remembers per animation (remembered.ts), for this one and for another.
  const families = ["view", "selection", "overlay-selection"];
  await page.evaluate(({ id, families }) => {
    for (const family of families) {
      localStorage.setItem(`stop-motion-studio:${family}:${id}`, JSON.stringify("x"));
      localStorage.setItem(`stop-motion-studio:${family}:another`, JSON.stringify("x"));
    }
  }, { id, families });
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
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(640);   // its cover, drawn anew

  await card.getByRole("link", { name: "Open My animation" }).click();
  await expect(studio.pictures()).toHaveCount(3);
  await expect.poll(widths).toEqual(before);   // the same lengths, in the same order
});

test("Download all animations in Settings saves them in one file, and Load project brings them all back", async ({ projects, studio, page }) => {
  await newAnimationWithAPicture(projects, studio, page);
  await projects.rename("My animation", "Dino");
  await expect(projects.card("Dino")).toBeVisible();
  await newAnimationWithAPicture(projects, studio, page);
  await expect(projects.cards()).toHaveCount(2);

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download all animations" }).click();
  const backup = await downloading;
  expect(backup.suggestedFilename()).toMatch(/^All animations \d{4}-\d{2}-\d{2}\.zip$/);
  await expect(dialog.getByRole("status")).toHaveText(/^Saved 2 animations: All animations /);
  await dialog.getByRole("button", { name: "Close" }).click();

  for (const name of ["Dino", "My animation"]) {
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(projects.card(name)).toHaveCount(0);
  }

  await page.getByLabel("Backup file").setInputFiles((await backup.path())!);
  await expect(page.getByRole("status").filter({ hasText: "Restored 2 animations" })).toBeVisible();
  await expect(projects.card("Dino")).toContainText("1 picture");
  await expect(projects.card("My animation")).toContainText("1 picture");
});

test("with no animations, there's nothing to download", async ({ projects, page }) => {
  await projects.open();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Download all animations" })).toBeDisabled();
});

test("restoring a file that isn't a backup says so, and adds nothing", async ({ projects, page }) => {
  await projects.open();
  await page.getByLabel("Backup file").setInputFiles({ name: "holiday.zip", mimeType: "application/zip", buffer: Buffer.from("not really a zip") });
  await expect(page.getByRole("status").filter({ hasText: "That file isn't a backup of an animation." })).toBeVisible();
  await expect(projects.cards()).toHaveCount(0);
});

test("the mouse wheel anywhere on the page scrolls the animations' column, at once, never gliding", async ({ projects, studio, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await studio.withoutCamera();
  for (let i = 0; i < 4; i++) {   // enough cards to need scrolling (each with a picture: empty ones aren't kept)
    await studio.open();
    await studio.seedPictures(1);
    await page.goto("/");
  }
  await expect(projects.cards()).toHaveCount(4);
  const column = page.locator(".home-projects");
  const start = await column.evaluate((element) => element.scrollTop);   // 0, or the real list's place when it loops
  await page.mouse.move(200, 360);   // over the title, far from the column
  await page.mouse.wheel(0, 300);
  await expect.poll(() => column.evaluate((element) => element.scrollTop)).not.toBe(start);
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);   // the page itself doesn't move

  // Over the column too, it's where the wheel takes it straight away (a smooth scroll would still be
  // where it was at this point): stop motion, no glide.
  const moved = await column.evaluate((element) => {
    const before = element.scrollTop;
    const card = element.querySelector(".nsc-project-card")!;
    card.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    return element.scrollTop - before;
  });
  expect(moved).toBe(120);
});

// The column goes round (useEndlessScroll): past the last animation come the first ones again. A
// copy of the list is drawn before and after the real one; whenever the view's middle leaves the
// real list, it's put back one list's height, onto the same cards. Nothing on screen moves.
test.describe("the column of animations goes round", () => {
  // Enough animations for the list to be taller than the window, seeded straight into storage.
  // Quickly: one animation backed up, then restored as `count` named copies from one bundle
  // (Film 1 to Film n), the first one deleted.
  async function manyAnimations(projects: Projects, studio: Studio, page: Page, count: number) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await newAnimationWithAPicture(projects, studio, page);
    const downloading = page.waitForEvent("download");
    await projects.card("My animation").getByRole("button", { name: "Back up My animation" }).click();
    const backup = unzipSync(new Uint8Array(await readFile((await (await downloading).path())!)));
    await page.getByRole("button", { name: "Delete My animation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(projects.cards()).toHaveCount(0);

    const manifest = JSON.parse(strFromU8(backup["project.json"]));
    const bundle = Object.fromEntries(Array.from({ length: count }, (_, i) => [`Film ${i + 1}.zip`, zipSync({ ...backup, "project.json": strToU8(JSON.stringify({ ...manifest, project: { ...manifest.project, name: `Film ${i + 1}` } })) })]));
    await page.getByLabel("Backup file").setInputFiles({ name: "films.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(bundle)) });
    await expect(projects.cards()).toHaveCount(count);
  }
  // The name of the card at a point of the column (a copy or the real one: what a child sees there).
  const nameAt = (page: Page, { x, y }: { x: number; y: number }) => page.evaluate(({ x, y }) => {
    const card = document.elementFromPoint(x, y)?.closest(".nsc-project-card");
    return card?.querySelector(".name")?.textContent ?? null;
  }, { x, y });
  // Where the card at a point is on screen, to the pixel.
  const placeAt = (page: Page, { x, y }: { x: number; y: number }) => page.evaluate(({ x, y }) => {
    const box = document.elementFromPoint(x, y)?.closest(".nsc-project-card")?.getBoundingClientRect();
    return box ? [Math.round(box.left), Math.round(box.top)] : null;
  }, { x, y });
  // A point on the first real card's cover, and how far down the next row of cards starts.
  const firstCard = (page: Page) => page.locator(".projects:not(.is-copy)").evaluate((list) => {
    const cards = [...list.querySelectorAll<HTMLElement>(".nsc-project-card")];
    const box = cards[0].querySelector(".cover")!.getBoundingClientRect();
    const row = (cards.find((card) => card.offsetTop > cards[0].offsetTop)?.offsetTop ?? 0) - cards[0].offsetTop;
    return { point: { x: box.left + box.width / 2, y: box.top + box.height / 2 }, row };
  });
  const scroll = (page: Page) => page.locator(".home-projects").evaluate((element) => {
    const real = element.querySelector(".projects:not(.is-copy)") as HTMLElement;
    const copy = real.previousElementSibling as HTMLElement | null;
    return { top: element.scrollTop, period: copy ? real.offsetTop - copy.offsetTop : 0 };
  });

  test("with few animations it doesn't: no copies", async ({ projects, studio, page }) => {
    await manyAnimations(projects, studio, page, 2);
    await expect(page.locator(".projects.is-copy")).toHaveCount(0);
  });

  test("it starts at the first animation, and the wheel takes it past the last to the first again, seamlessly", async ({ projects, studio, page }) => {
    await manyAnimations(projects, studio, page, 8);
    await page.reload();
    await expect(page.locator(".projects.is-copy")).toHaveCount(2);
    await expect(projects.cards()).toHaveCount(8);   // the copies aren't counted, nor read out
    await expect(page.getByRole("button", { name: "Rename Film 1" })).toHaveCount(1);   // the copies' buttons aren't read out
    await expect(projects.cards().first()).toBeInViewport();   // the real first card, in its place
    const { period } = await scroll(page);
    expect(period).toBeGreaterThan(720);
    const { point, row } = await firstCard(page);
    const first = await nameAt(page, point);   // the first real card: what's at the top
    expect(first).toMatch(/^Film \d$/);
    const place = await placeAt(page, point);

    // One whole list's height down, in wheel steps: the same cards are back where they were, and the
    // scroll never ran off (it was put back as it went).
    await page.mouse.move(200, 360);
    for (let moved = 0; moved < period; moved += 100) await page.mouse.wheel(0, Math.min(100, period - moved));
    await expect.poll(() => nameAt(page, point)).toBe(first);
    expect(await placeAt(page, point)).toEqual(place);   // to the pixel: nothing moved
    expect((await scroll(page)).top).toBeLessThan(2 * period);

    // Up from the first: the last animation comes before it.
    await page.reload();
    await expect(projects.cards().first()).toBeInViewport();
    const lastRow = await page.locator(".projects:not(.is-copy)").evaluate((list) => {
      const cards = [...list.querySelectorAll<HTMLElement>(".nsc-project-card")];
      const bottom = cards[cards.length - 1].offsetTop;
      return cards.filter((card) => card.offsetTop === bottom).map((card) => card.querySelector(".name")!.textContent);
    });
    await page.mouse.move(200, 360);
    await page.mouse.wheel(0, -row);   // a row up
    await expect.poll(() => nameAt(page, point)).toBe(lastRow[0]);   // the last row, from the copy above
  });

  test("a finger drags it along, and a tap still opens an animation", async ({ projects, studio, page, browserName }) => {
    test.skip(browserName !== "chromium", "Touches are sent through Chromium's DevTools protocol.");
    await manyAnimations(projects, studio, page, 8);
    await page.reload();
    await expect(page.locator(".projects.is-copy")).toHaveCount(2);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const column = (await page.locator(".home-projects").boundingBox())!;
    const x = column.x + column.width / 2;
    const before = (await scroll(page)).top;
    await touch("touchStart", x, 500);
    for (let y = 480; y >= 300; y -= 20) await touch("touchMove", x, y);
    await touch("touchEnd", x, 300);
    const dragged = (await scroll(page)).top - before;
    expect(dragged).toBeGreaterThan(150);   // about 200: the finger's way, give or take the slant and the wrap

    // A tap, no move: the card under it opens.
    await page.reload();
    await expect(projects.cards().first()).toBeInViewport();
    const cover = await projects.cards().first().getByRole("link").boundingBox();
    await touch("touchStart", cover!.x + cover!.width / 2, cover!.y + cover!.height / 2);
    await touch("touchEnd", cover!.x + cover!.width / 2, cover!.y + cover!.height / 2);
    await expect(page).toHaveURL(/\/studio\?project=/);
  });
});

test("a card plays its animation while the pointer is over it, and stops when it leaves", async ({ projects, studio, page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });   // the preview only plays with motion on (the fixture turns it off)
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(4);   // four colours, one tick each at 8 per second
  await page.getByRole("link", { name: "All projects" }).click();
  const card = projects.card("My animation");
  await expect(card).toBeVisible({ timeout: 15_000 });   // the intro puts the cards down near its end
  const preview = card.locator("canvas.preview");
  await expect(preview).not.toHaveClass(/is-playing/);

  await card.getByRole("link", { name: "Open My animation" }).hover();
  await expect(preview).toHaveClass(/is-playing/);
  // The middle of the picture changes colour as the pictures go by (the renderer, looping).
  const colours = new Set<string>();
  for (let i = 0; i < 12; i++) {
    colours.add(await preview.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("2d")!.getImageData(canvas.width / 4, canvas.height / 4, 1, 1).data.slice(0, 3).join(",")));
    await page.waitForTimeout(80);
  }
  expect(colours.size).toBeGreaterThan(1);

  await page.mouse.move(5, 5);   // away from the card
  await expect(preview).not.toHaveClass(/is-playing/);
});

test("the home page appears all at once: no loading line flashing up, no cards popping in after it", async ({ studio, page }) => {
  await studio.withoutCamera();
  for (let i = 0; i < 3; i++) { await studio.open(); await studio.seedPictures(2); }
  await page.addInitScript(() => {
    // Records, every frame, what can be seen of the page while it loads: until half a second after
    // it first shows (a busy machine can take a while to get there), at most 8 s.
    const seen: { shown: boolean; loading: boolean; cards: number }[] = [];
    Object.assign(window, { seen });
    const start = performance.now();
    let shownAt = Infinity;
    const look = () => {
      const home = document.querySelector<HTMLElement>("#nsc--home");
      if (home) {
        const shown = Number(getComputedStyle(home).opacity) > 0;
        if (shown) shownAt = Math.min(shownAt, performance.now());
        seen.push({ shown, loading: !!document.querySelector(".status"), cards: document.querySelectorAll(".nsc-project-card:not(.is-copy)").length });
      }
      const now = performance.now();
      if (now - start < 8000 && now - shownAt < 500) requestAnimationFrame(look);
      else Object.assign(window, { done: true });
    };
    requestAnimationFrame(look);
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as { done?: boolean }).done, undefined, { timeout: 10_000 });
  const seen = await page.evaluate(() => (window as unknown as { seen: { shown: boolean; loading: boolean; cards: number }[] }).seen);
  const shown = seen.filter((moment) => moment.shown);
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.some((moment) => moment.loading)).toBe(false);        // the loading line never shows (it's quick)
  expect(shown.every((moment) => moment.cards === 3)).toBe(true);    // from the first moment it's seen, every card is there
});

test("at the end of the intro, after the buttons, the animations' column slides up into place in four jumps", async ({ projects, studio, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await studio.withoutCamera();
  for (let i = 0; i < 2; i++) { await studio.open(); await studio.seedPictures(1); }
  await page.emulateMedia({ reducedMotion: "no-preference" });   // the intro plays (the fixture turns it off)
  await page.addInitScript(() => {
    // Every frame while the page loads: is Settings showing, and where the first card is.
    const seen: { settings: boolean; top: number | null }[] = [];
    Object.assign(window, { seen });
    const start = performance.now();
    const look = () => {
      const settings = document.querySelector('[aria-label="Settings"]');
      const card = document.querySelector(".nsc-project-card:not(.is-copy)");
      seen.push({ settings: !!settings && getComputedStyle(settings).visibility !== "hidden", top: card ? Math.round(card.getBoundingClientRect().top) : null });
      if (performance.now() - start < 8000) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await projects.open();
  await expect(projects.cards().first()).toBeInViewport({ timeout: 15_000 });
  await expect(page.locator(".home-projects")).toHaveAttribute("style", /--slide: ?0(;|$)/, { timeout: 10_000 });   // the slide over: in its place
  await page.waitForTimeout(200);   // a frame or two seen there
  const seen = await page.evaluate(() => (window as unknown as { seen: { settings: boolean; top: number | null }[] }).seen);
  const placed = seen.at(-1)!.top!;
  const moving = seen.filter((moment) => moment.top !== null && moment.top !== seen.find((m) => m.top !== null)!.top);   // from its first move on
  expect(moving.length).toBeGreaterThan(0);
  expect(moving.every((moment) => moment.settings)).toBe(true);   // it moves only once the buttons are there
  const positions = [...new Set(seen.map((moment) => moment.top).filter((top) => top !== null))];
  // Exactly its five poses (below the window, then four jumps up, the last into place), nothing in
  // between: it jumps from frame to frame, stop motion, with no transition.
  expect(positions).toHaveLength(5);
  expect(positions.every((top, i) => i === 0 || top! < positions[i - 1]!)).toBe(true);   // only ever up
  const jumps = positions.slice(1).map((top, i) => positions[i]! - top!);
  for (const jump of jumps) expect(Math.abs(jump - jumps[0])).toBeLessThanOrEqual(1);   // each jump as far as the others (a pixel of rounding)
  expect(positions.at(-1)).toBe(placed);
  expect(positions[0]!).toBeGreaterThan(720);                       // it started out of sight, below the window
});

test("coming back from the studio, the intro doesn't play again; a reload plays it", async ({ studio, page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });   // the intro would play
  await studio.withoutCamera();
  await studio.open();
  // Every frame from here on (the same page: going home doesn't reload it), once the home page
  // shows: how many of its cards and buttons aren't down yet.
  await page.evaluate(() => {
    const seen: number[] = [];
    Object.assign(window, { seen });
    const look = () => {
      const home = document.querySelector<HTMLElement>("#nsc--home");
      const settings = document.querySelector('[aria-label="Settings"]');
      if (home && settings && Number(getComputedStyle(home).opacity) > 0) {
        seen.push(document.querySelectorAll('.title [data-shown="false"]').length + (getComputedStyle(settings).visibility === "hidden" ? 1 : 0));
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await page.getByRole("link", { name: "All projects" }).click();
  const settings = page.getByRole("button", { name: "Settings" });
  await expect(settings).toBeVisible();
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => (window as unknown as { seen: number[] }).seen);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((missing) => missing === 0)).toBe(true);   // everything down from the first moment it shows

  await page.reload();
  await expect(settings).toBeHidden();                          // the intro again: the buttons come last
  await expect(settings).toBeVisible({ timeout: 15_000 });
});

// The demo animations (public/demos/demos.zip): added on a browser's first visit, once.
test.describe("demo animations", () => {
  test.use({ withDemos: true });
  const DEMOS = ["Arlequin", "Names", "Paper animation"];

  test("a first visit adds the demo animations, once: deleted, they don't come back", async ({ projects, page }) => {
    await projects.open();
    for (const name of DEMOS) await expect(projects.card(name)).toBeVisible({ timeout: 20_000 });   // their photos unpacked first
    await expect(projects.cards()).toHaveCount(3);

    await page.reload();
    await expect(projects.card("Names")).toBeVisible();
    await expect(projects.cards()).toHaveCount(3);   // not added again

    await page.getByRole("button", { name: "Delete Names" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await page.reload();
    await expect(projects.card("Arlequin")).toBeVisible();
    await expect(projects.cards()).toHaveCount(2);
  });

  test("Settings adds them again", async ({ projects, page }) => {
    await projects.open();
    await expect(projects.cards()).toHaveCount(3, { timeout: 20_000 });
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.getByRole("button", { name: "Add the demo animations" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Added 3 demo animations", { timeout: 20_000 });
    await expect(projects.cards()).toHaveCount(6);
  });

  test("a demo opens in the studio with all its pictures", async ({ projects, studio, page }) => {
    await studio.withoutCamera();
    await projects.open();
    await expect(projects.card("Arlequin")).toBeVisible({ timeout: 20_000 });
    await projects.card("Arlequin").getByRole("link", { name: "Open Arlequin" }).click();
    await expect(page).toHaveURL(/project=/);
    await expect(studio.pictures()).toHaveCount(20);
  });
});
