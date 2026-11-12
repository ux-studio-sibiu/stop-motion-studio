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
- **From step 08 on, a change to a user-facing flow** (capture, timeline editing, playback, export,
  projects) updates or adds its Playwright spec in `e2e/` and runs `npm run test:e2e`.
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
