# Stop-motion Studio

A stop-motion studio for kids that runs in the browser: take pictures with the webcam, arrange them on
a timeline, play them back and export a GIF or video. No accounts, and photos never leave the device.

Live at **https://stop-motion.studiosibiu.com/**. Built in 33 small, reviewable steps:
[PLAN.md](PLAN.md) has the decisions and the data model, [ROADMAP.md](ROADMAP.md) the steps. Each
finished step has its own page in [`public/steps/`](public/steps/index.html), served by the app at
`/steps/index.html`.

## Features

**Making an animation**
- **Camera:** a live webcam picture with see-through (onion skin) of the last 1-3 pictures, an
  outline or "spot the difference" look to line a toy up with where it was, a shutter click, the
  camera's zoom and framing kept per animation, and its focus, exposure and white balance locked so
  every picture matches. Photos can be added from the computer too (Add photos, or dropped on the
  page).
- **Time-scaled timeline:** each picture is as wide as it lasts. Drag its edge to hold it longer
  (snapping to whole frames), drag pictures to reorder them (several at once), duplicate, delete,
  insert an empty see-through frame; a seconds ruler, zoom, a minimised view, and extra rows shown
  on demand. Everything also works from the keyboard (arrows, Ctrl+arrows, `[` `]`).
- **Undo and redo** for every change, with the step's name on the button.
- **Fixing a picture:** move, scale, rotate and flip it on the stage, with snap guides to line it up
  with the pictures around it; brightness and contrast, stored as numbers and applied when drawing,
  so nothing is lost. A safe zone shows the edge the export leaves out.
- **Extras on top:** speech and thought bubbles that belong to one picture; text and shapes that
  live in time on their own row, across any number of pictures; free drawing with a pencil and
  eraser.
- **Sound:** a sound row under the pictures with about 75 effects (18 made by a small synthesiser,
  the rest CC0 recordings), scheduled on the audio clock so they stay in step with the pictures,
  and mixed into the exported video.
- **Playback** at 5-15 pictures a second, looping or not.

**Keeping and sharing it**
- **Save as GIF** (encoded in a Web Worker) or **as video** (MP4 or WebM through WebCodecs, with its
  sound), cut to the safe zone.
- **Projects page:** animated cardboard intro, cards that play their animation under the pointer, a
  column that scrolls round and round, rename, delete, storage use with an 80% warning.
- **Backups:** any animation, or all of them in one file, as a `.zip` with a documented, versioned
  format, restored on this device or another.
- **Demo animations** added on a first visit (photos re-saved lighter: 8.5 MB down to 4.2 MB).
- **Offline:** an installable app whose service worker keeps the studio on the device; online it's
  always the latest version, and a page opened offline offers Update when a new one arrives.
- **Remembers how it was left:** each animation's open tab, zoom, scroll, selection, see-through,
  layers and export settings, after a reload.
- **Help** window with every keyboard shortcut (`?`).

**Look and feel.** Cut from cardboard, like the sets children build: every big piece is cardboard
with paper pasted on it, drawn from photos of real cardboard, and nothing glides: hover, press,
scrolling and the intro move in jumps, like stop motion. A `/design` page shows every part of the
interface, with a panel to try the tokens live.

## Architecture

A **client-only Next.js app, exported as static files**: camera, canvas, storage, encoding and
sound all run in the browser, so there is no server to run and no photo leaves the device. Routes
are `/` and `/studio?project=<id>` (a query, because a static export can't know ids that only
exist in someone's browser).

**Four layers, one import direction**, enforced by ESLint:

```
ui        studio/, features/, projects/, app/   React components, SCSS, hooks
  ↓
store     store/                                Zustand: the live editor state
  ↓
core      core/                                 plain TypeScript: model, commands, timing, renderer,
  ↑                                             export frames, archive format, sound library
adapters  adapters/                             Dexie storage, camera, encoders, archive, preferences
```

- **`core/` is framework-free** (no React, Next, Dexie or Zustand) and every module in it has unit
  tests. Adapters implement its interfaces (`ProjectRepository`, the image caches).
- **Every change to an animation is a command** with `do` and `undo`, from the first editing step:
  that's what makes undo complete and safe.
- **Time is counted in ticks** (1/fps) for pictures, extras and sounds alike, so all rows stay lined
  up when the speed changes; seconds and pixels are worked out only for showing.
- **One renderer** (`renderAt(time)`, Canvas 2D) draws the stage, the see-through, the projects
  page's card previews and every exported frame: what you see is what you export.
- **Storage:** IndexedDB through Dexie, behind a repository that a shared contract test holds to its
  behaviour. Frame order is one list on the project, so reordering or deleting rewrites one record.
  Thumbnails are stored at capture, so the timeline never loads full photos.
- **Feature folders, placed by hand:** each feature (camera, picture, objects, draw, sounds,
  exports...) lives in `src/features/<name>/`, and `Studio.tsx` places its parts in its JSX. A
  plugin registry was built and removed: moving a piece of UI should be moving one line.
- **Remembered UI state** has one typed registry (`src/studio/remembered.ts`), every stored value
  checked by a parser, because anything can be in `localStorage`.
- **No drag library:** reordering, resizing and every drag are plain pointer events, so they work
  with a finger and fit the time-scaled widths.
- **The service worker is hand-written** (`scripts/sw.js`); after `next build`, a script lists the
  export with tested rules (`core/offline/`) and writes it with a version per file list.
- **Performance measured, not guessed:** 2000 pictures open in about a second, scroll at 60 fps and
  answer a key in well under 200 ms, through memoised pictures, a playhead that redraws alone, and a
  store that hands back the same objects when nothing changed. No virtualising was needed.

**Tests, in three layers:** about 440 Vitest unit tests (Node, with `fake-indexeddb` for storage),
57 pixel tests of the renderer in a real Chromium (Vitest browser mode), and 164 Playwright
end-to-end tests across 21 specs: the real app, real IndexedDB and a fake webcam playing a generated
video. Every logic change comes with its tests (`CLAUDE.md`).

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
