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
  projects) updates or adds its Playwright spec in `e2e/`. How much to run depends on the size:
  - a small change inside one flow: only the specs for that flow, in Chromium
    (`npm run test:e2e -- e2e/timeline.spec.ts`, about 15 s);
  - a change that touches several flows, shared code (`Studio.tsx`, `useProject`, `e2e/fixtures.ts`)
    or storage, and the end of a roadmap step: all specs in Chromium (`npm run test:e2e`, about 25 s);
  - WebKit (`npm run test:e2e:all`, both browsers) only when asked, or for a change aimed at Safari:
    on Windows its camera tests all skip, so it adds time and little coverage.
  Say in the summary which of these ran.
  - **Seed pictures, don't photograph them**, unless the test is about taking pictures:
    `studio.seedPictures(n)` writes them straight into storage, much faster and steadier than
    `cameraOn()` + `takePictures(n)`.
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

## Layers

`core/` is plain TypeScript (no React, Next, Dexie, Zustand); `adapters/` import only `core/`. ESLint
enforces both. See `PLAN.md` §2.
