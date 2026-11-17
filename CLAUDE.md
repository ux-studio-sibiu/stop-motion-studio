# Stop-motion Studio

Plan: `PLAN.md`. Order of work: `ROADMAP.md`. Notes for each finished step: `public/steps/NN-*.html`
(the notes live there, not in Markdown). Next.js specifics: `AGENTS.md`.

## Tests are part of every change

This overrides the workspace `fast-iteration` rule for logic in this repo: styling and markup stay
fast, logic is never "trust the edit".

- **A change in `src/core/`, `src/adapters/` or `src/store/` updates its Vitest tests in the same
  change**: new behaviour gets a test, changed behaviour gets its test changed, removed behaviour gets
  its test removed. A fix starts with a test that fails without the fix.
- **Run `npm test` before calling any such change done** (it takes under a second), and say in the
  summary which tests were added or changed. If no test changed, say why.
- **Drawing code (`src/core/render/`) also runs `npm run test:browser`** (about 2 s): its pixel tests
  in `*.browser.test.ts` draw on a real canvas in Chromium. Anything else stays in Node tests.
- **From step 08 on, a change to a user-facing flow** (capture, timeline editing, playback, export,
  projects) updates or adds its Playwright spec in `e2e/`. **Run only the specs relevant to the
  change, never everything**: the specs for the flows the change touches, in one command, in
  Chromium against the dev server, which skips the production build
  (`npm run test:e2e:dev -- e2e/picture.spec.ts e2e/stage.spec.ts`, about 8-12 s for one spec; it reuses
  the `next dev` on port 3000, or starts one). Which spec covers what:
  - `camera.spec`: the camera, capture; `stage.spec`: the stage, see-through, safe zone, side panel tabs;
  - `picture.spec`: moving, snapping, zoom, brightness and contrast (the Picture tab);
  - `timeline.spec`, `frames.spec`, `resize.spec`, `reorder.spec`: the timeline, delete and duplicate,
    lengths, reordering;
  - `history.spec`: undo and redo; `playback.spec`: playing; `persistence.spec`: reloads and the
    load gate; `projects.spec`: the projects page; `storage.spec`: clean-up, full storage, the 80% warning; `objects.spec`: the Objects tab, speech bubbles, text and shapes; `overlays.spec`: the overlay track, objects in time; `draw.spec`: the Draw tab, free drawing.
  Shared code (`Studio.tsx`, `useProject`, `e2e/fixtures.ts`, storage) means the specs of the flows
  it really changes, not all of them. **The full suite** (`npm run test:e2e`, production build, about
  40 s) and **WebKit** (`npm run test:e2e:all`) run only when the user asks. Say in the summary which
  specs ran, and which were left out.
  - **Seed pictures, don't photograph them**, unless the test is about taking pictures:
    `studio.seedPictures(n)` writes them straight into storage, much faster and steadier than
    `cameraOn()` + `takePictures(n)`. And **don't start the camera** unless the test is about it:
    `studio.withoutCamera()` before `open()` keeps it off (starting the fake camera is what made
    tests flaky when many browsers run at once).
  - **Run it once.** Repeat runs (`--repeat-each`, or the suite several times) only while chasing
    a test that fails now and then, and then only that test, not the whole suite.
- **Never weaken a test to make it pass.** If a test fails, either the code is wrong or the behaviour
  changed on purpose; in the second case, change the test and say so.
- **Tests describe behaviour, not implementation**: what a function returns or what a user sees, not
  which internal helper was called. Storage behaviour goes in `repositoryContract.ts`, so every
  repository is held to it.
- **Pure CSS / SCSS and copy changes** need no new tests; run nothing beyond what the workspace rule
  asks.

Each step page lists its tests under "Files in this step" and checks them in the review checklist.

## Remembered UI state

UI state a child would expect to find as they left it after a reload (an open tab, a setting, a
zoom, the selection) is remembered **by default**: add it to the registry in
`src/studio/remembered.ts` (one line, a typed `definePreference` with a parser) and use
`useRememberedState` or `useRememberedStore`. Moment-to-moment state (an open dropdown, the
playhead, a drag) isn't. Per-animation state uses a preference family, and deleting an animation
forgets it (`ProjectsPage`). Add an end-to-end check that it survives a reload.

## Layers

`core/` is plain TypeScript (no React, Next, Dexie, Zustand); `adapters/` import only `core/`. ESLint
enforces both. See `PLAN.md` §2.
