# Stop-motion Studio

A stop-motion studio for kids that runs in the browser: take pictures with the webcam, arrange them on
a timeline, play them back and export a GIF or video. No accounts, and photos never leave the device.

> Work in progress, built one reviewable step at a time. [PLAN.md](PLAN.md) has the architecture and
> decisions, [ROADMAP.md](ROADMAP.md) the steps. Each finished step has its own page in
> [`public/steps/`](public/steps/index.html), served by the app at `/steps/index.html`.

## Stack

Next.js (App Router, static export) · React · TypeScript · SCSS · Zustand · Dexie (IndexedDB) ·
gifenc (GIF) · Mediabunny (video) · fflate (backups) · Vitest · Playwright.

## Layout

```
src/app/        routes: projects list, studio, design system (/design)
src/core/       plain TypeScript: model, commands, playback, renderer, export, sound (no React/Next/Dexie)
src/adapters/   browser and library code behind core interfaces: storage, camera, encoders
src/store/      Zustand editor state
src/studio/     the studio screen and its SCSS; timeline/ for the timeline
src/features/   one folder per feature (camera, picture, objects, draw, sounds, exports...), placed by Studio.tsx
src/projects/   the projects page (home): its intro, the cards, backup and restore
src/design-system/ the /design page: every part of the interface, and the token panel
src/offline/    the service worker's page side: registering it, the Update notice, the install offer
scripts/        build helpers: sw.js (the service worker) and build-offline.mjs, which writes it into out/
src/styles/     tokens (globals, _colours), breakpoints, the cardboard mixins
e2e/            Playwright specs, one per flow
public/steps/   build notes, one HTML page per step
```

The import direction is enforced by ESLint: `core` imports nothing from the other layers, `adapters`
import only `core`.

## Develop

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Static site in `out/`, then its service worker, `out/sw.js` (step 32: what it keeps offline, listed by the build) |
| `npm start` | Serves `out/` locally at http://localhost:3100 (away from the dev server's port, so the offline worker it installs never answers for `npm run dev`) |
| `npm test` | Vitest in Node, once (`npm run test:watch` to keep it running) |
| `npm run test:browser` | Vitest browser mode in Chromium: the renderer's pixel tests (`*.browser.test.ts`) |
| `npm run lint` | ESLint, including the layering rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright end-to-end tests in Chromium (builds and serves the app on port 3200); add a file to run one spec: `npm run test:e2e -- e2e/timeline.spec.ts` |
| `npm run test:e2e:all` | The same in Chromium and WebKit: on request, or for Safari-specific changes |
| `npm run test:e2e:ui` | The same in Playwright's UI mode, test by test |
| `npm run test:e2e:report` | Opens the last HTML report |
| `npm run test:e2e:dev` | Playwright against the dev server (no production build): the quick way to run one or two specs |
| `MEASURE=1 npm run test:e2e -- e2e/performance.spec.ts` | Measures a 2000-picture animation and prints the numbers (`MEASURE_PICTURES` for another count) |

The webcam needs a secure context: `localhost` works, a LAN IP over plain `http://` does not.

## Cardboard letters

The home page's title, burst and cardboard cards come from the cardboard letters font, a project of
its own next to this one (`casedeschise/fonts/cardboard letters/`). `npm run sync:cardboard` copies
in its CSS (`src/projects/cardboard-letters/`), its shape module for bursts, and the pictures the
studio uses (`public/cardboard-letters/bases/`): only the big piece's edges and surface. Everything
else stays in the font project and can be brought in again when it's needed:

- **Cardboard letter tiles, word cards, cardboard bursts**: their pictures (`base-N.png`,
  `grain-N.png`, `sheet-grain.webp`, `sheet-strip.webp`). Add them to `PICTURES` in
  `scripts/sync-cardboard-letters.mjs` and run the sync; the CSS and the shape module already point
  at them.
- **Cut-outs** (a camera, a star, a rocket, a robot...: 50 pictures, with their sizes in
  `cutouts.json`), in the font's `cutouts/`. The home page decorated with them once; the sync would
  need to copy them again.
- **The old title's letters** (STOP MOTION START as pictures, before the font), in the font's
  `ref/old-title-letters/`.

Change the font there, then run the sync; don't edit the copies here.

## Conventions

`STYLE_GUIDE.md` (synced from the workspace) and `COMPONENT_PATTERNS.md`: `nsc-` on component roots
only, no BEM `__` / `--` classes, hyphenated class names, content as JSX children.
