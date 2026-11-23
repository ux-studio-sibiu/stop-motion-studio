import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Long animations (step 31). Measured first: the timeline shows every picture (no virtualising),
// which holds up to a couple of thousand pictures; what slowed it down was redrawing all of them on
// every change (the playhead while playing, a new selection, a save coming back). One light check
// that a long animation stays usable, with limits generous enough for a busy machine, and a
// measuring run on request:
//   MEASURE=1 npm run test:e2e -- e2e/performance.spec.ts           (production build: real numbers)
//   MEASURE=1 MEASURE_PICTURES=500 npm run test:e2e:dev -- e2e/performance.spec.ts

// Each arrow-key press, from the key to the next paint (the browser's Event Timing), in ms. Presses
// answered within a frame (16 ms) aren't reported by the browser: they count as 16.
async function arrowPresses(page: Page, count: number): Promise<number[]> {
  await page.evaluate(() => {
    const keys: number[] = [];
    (window as unknown as { keyTimes: number[] }).keyTimes = keys;
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (entry.name === "keydown") keys.push(entry.duration); }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
  });
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  const slow = await page.evaluate(() => (window as unknown as { keyTimes: number[] }).keyTimes);
  return [...slow, ...Array<number>(Math.max(0, count - slow.length)).fill(16)];
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test("a long animation (1000 pictures) opens, scrolls to its end and answers the keys quickly", async ({ studio, page }) => {
  test.slow();
  await studio.withoutCamera();
  await studio.open();
  await studio.seedPictures(1000, { onePhoto: true });

  await studio.picture(1).click();
  await page.keyboard.press("End");   // the last picture: the timeline scrolls to it
  await expect(studio.picture(1000)).toHaveAttribute("aria-selected", "true");
  await expect(studio.picture(1000)).toBeInViewport();

  await page.keyboard.press("Home");
  // Well within what feels instant (200 ms is the web's "responsive" line); before step 31 every
  // press redrew all 1000 pictures.
  expect(median(await arrowPresses(page, 8))).toBeLessThan(200);
  await expect(studio.picture(9)).toHaveAttribute("aria-selected", "true");
});

test("measure a long animation (MEASURE=1 only)", async ({ studio, page }) => {
  test.skip(!process.env.MEASURE, "a measuring run, on request");
  test.setTimeout(180_000);
  const count = Number(process.env.MEASURE_PICTURES ?? 2000);
  await studio.withoutCamera();
  await studio.open();
  const started = Date.now();
  await studio.seedPictures(count, { onePhoto: true });   // includes the reload that reads them back
  const opened = Date.now() - started;

  const scroll = await page.evaluate(async () => {
    const element = document.querySelector<HTMLElement>(".timeline-scroll")!;
    const times: number[] = [];
    let last = performance.now();
    const max = element.scrollWidth - element.clientWidth;
    await new Promise<void>((done) => {
      const step = (now: number) => { times.push(now - last); last = now; element.scrollLeft += 40; if (element.scrollLeft < max) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    });
    return { worstFrame: Math.round(Math.max(...times)), framesOver20: times.filter((time) => time > 20).length };
  });

  await studio.picture(1).click();
  const arrows = await arrowPresses(page, 10);

  await page.keyboard.press("Home");
  const playback = await page.evaluate(async () => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + 3000;
    document.querySelector<HTMLElement>('[aria-label="Play"]')!.click();
    await new Promise<void>((done) => { const step = (now: number) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    document.querySelector<HTMLElement>('[aria-label="Pause"]')?.click();
    return { worstFrame: Math.round(Math.max(...times)), framesOver50: times.filter((time) => time > 50).length };
  });
  const heapMB = await page.evaluate(() => Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e6));

  console.log(JSON.stringify({ pictures: count, openedMs: opened, arrowKeyToPaintMs: { median: Math.round(median(arrows)), worst: Math.round(Math.max(...arrows)) }, scroll, playback, heapMB }));
});
