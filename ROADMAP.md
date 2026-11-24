# Stop-motion Studio: roadmap

The studio is built in **33 small steps (00-32)**. Each step is one reviewable change and one commit,
and leaves the app working. Architecture and decisions are in [PLAN.md](PLAN.md); this file is the order
of work.

## How a step works

1. You ask for step N.
2. Claude implements only that step, writes its page in `public/steps/NN-slug.html` (what was built,
   decisions, gotchas, how to check it, files, review checklist), links it from
   `public/steps/index.html` and ticks it here. The notes live in those HTML pages, not in Markdown;
   this file stays the plan. In the running app they're at `/steps/index.html`.
3. You review, ask questions or request changes, then commit it yourself (Claude never commits).
4. Optional: tag it `step-NN`, so `git checkout step-07` shows the app at that point.

Each step below lists: **Builds** (what is implemented), **Decisions**, **Watch out**, **Check** (how
to see it works). Steps marked *(core)* touch only plain TypeScript and come with Vitest tests.

**Tests change with the code.** The repo's `CLAUDE.md` makes it a rule: every change to logic adds or
updates its tests in the same change, and `npm test` runs before a change counts as done.

**Testing in layers.** Vitest unit tests for logic from the start; Playwright end-to-end tests from step
08 on. After step 08, every step with a user-facing flow adds or extends a Playwright spec (`e2e/`) and
lists it in its review checklist, so `npm run test:e2e` keeps proving the whole app works (Chromium; `test:e2e:all` adds WebKit when needed). Vitest's
browser mode joins in step 15 for canvas pixel tests.

---

## Part 1 - Foundations

### 00 · Setup
- **Builds:** `create-next-app` with TypeScript, App Router, ESLint, `src/`, **no Tailwind**. Adds
  `sass`, `vitest`. `next.config` with `output: "export"` and `images.unoptimized`. Empty `core/`,
  `adapters/`, `store/`, `studio/`, `features/`, `styles/` folders. ESLint rule that blocks imports from
  `react`, `next`, `dexie` and the other layers inside `core/`. README with scripts.
- **Decisions:** static export from day one, so nothing server-only sneaks in (no API routes, server
  actions or `next/image` optimisation). The layering rule is enforced by lint, not by discipline.
- **Watch out:** `create-next-app` asks about Tailwind; answer no. Copy the workspace `STYLE_GUIDE.md` /
  `COMPONENT_PATTERNS.md` via `scripts/sync-style-guide.ps1` instead of hand-copying.
- **Check:** `npm run dev`, `npm run build` (produces `out/`), `npm test` runs one smoke test.

### 01 · Studio shell and design tokens
- **Builds:** `styles/` (tokens on `:root` with a dark set, breakpoints, globals), `/studio` page with the
  layout grid: toolbar, camera/side panel, stage, properties panel, timeline, playback bar. Placeholder
  content only. `/` links to the studio.
- **Decisions:** the studio page is a Client Component boundary (`"use client"` at the studio root). The
  `?project=` param is read with `useSearchParams` inside a `<Suspense>`. Tablet landscape is the primary
  layout; phone portrait collapses side panels.
- **Watch out:** `useSearchParams` without `<Suspense>` fails the static build. Keep `nsc-` on roots
  only (`nsc-studio`, then plain `.toolbar`, `.stage`, ...).
- **Check:** layout holds from 768 px to desktop; build still passes.

### 02 · Core model *(core)*
- **Builds:** `core/model`: `Project`, `Frame`, `StoredImage`, `StoredThumb` types, `createProject()`,
  `createFrame()` with default transform/adjust, `newId()` (wraps `crypto.randomUUID`),
  `SCHEMA_VERSION = 1`, `frameDuration(project, frame)`.
- **Decisions:** timing is `hold` in ticks of `1/fps` (see PLAN §3). Order lives in `project.frameIds`.
  Pure functions return new objects (no mutation), which commands and undo rely on later.
- **Watch out:** `crypto.randomUUID` needs a secure context; localhost counts, plain `http://` on a LAN IP
  does not.
- **Check:** unit tests for defaults and duration maths.

---

## Part 2 - Capture

### 03 · Camera
- **Builds:** `adapters/camera/camera.ts` (plain functions: open, stop, list, permission check, error →
  status) and `studio/useCamera` (the lifecycle): starts/stops `getUserMedia`, lists devices, switches
  and remembers the camera, exposes `status` (`idle | asking | live | denied | no-camera | busy |
  insecure | unsupported | error`). `CameraPanel` (picker, on/off) and the live `<video>` in the stage,
  with friendly messages per status.
- **Decisions:** the preview is **not mirrored** and is cover-cropped to the frame: what you see is
  exactly what a capture will be, which onion skin and alignment (steps 17-19) depend on. Audio is off.
  The camera starts by itself only if permission was already granted; otherwise after a tap. It turns
  off while the tab is hidden.
- **Watch out:** stop every track on unmount, or the camera light stays on. React Strict Mode mounts
  twice in dev: guard against two streams. iOS needs `playsInline` + `muted`. Device labels are empty
  until permission is granted.
- **Check:** allow/deny permission, unplug the webcam, switch cameras; the light turns off on leaving.

### 04 · Editor store
- **Builds:** `store/editorStore` (a vanilla Zustand store factory) with slices: `project` (current
  project + frames by id), `selection`, `playback` (`isPlaying`, `playhead` in ticks), `ui`
  (`timelineZoom`). `store/useEditor` (the app's store instance and selector hooks).
  `adapters/images/imageCache`. The studio title reads the project name from the store.
- **Decisions:** the store holds **metadata only, never Blobs**. Blobs go to an `ImageCache` (a
  `Map<imageId, Blob>` for now, Dexie in step 07). Selectors per component to avoid re-renders. The
  playhead is a tick, not a frame index, because overlays live in time.
- **Watch out:** don't put the `MediaStream` or DOM nodes in the store; keep them in refs.
- **Check:** store unit tests; React DevTools shows no full-tree re-render on selection change.

### 05 · Capture to an in-memory timeline
- **Builds:** `core/render/fit` (`coverCrop`, tested) *(core)*; `adapters/camera/capture`: draw the
  video to a canvas at the project's working resolution (cover-crop), `toBlob` JPEG 0.9, plus a 160 px
  thumbnail made from that picture. The image cache owns object URLs. Big capture button + Space key,
  picture counter, a short flash. A plain timeline strip of thumbnails with selection (no persistence
  yet, equal widths; time scaling comes in step 10).
- **Decisions:** resize at capture, not at export, so storage stays small. Thumbnail generated now so
  the timeline never decodes full images.
- **Watch out:** `videoWidth` is 0 until `loadedmetadata`; disable capture until then. Space must not
  capture while focus is in an input or on a button (it would also "click" it). Revoke every object URL.
- **Check:** capture 10 pictures; thumbnails appear instantly; memory stays flat in DevTools.

---

## Part 3 - Persistence and testing

### 06 · Dexie schema and repository *(core + adapter)*
- **Builds:** `core/model/ProjectRepository` interface. `adapters/storage/db.ts` with version 1 tables:
  `projects: "id, updatedAt"`, `frames: "id, projectId"`, `images: "id, projectId"`,
  `thumbs: "imageId, projectId"`. `createDexieRepository(db)` implementing it. A reusable
  **contract test** (`repositoryContract.ts`) that any future repository (e.g. a cloud one) must also
  pass, run here against Dexie on `fake-indexeddb`.
- **Decisions:** thumbs are a separate table so listing them never touches full images. Only fields
  that are queried are indexed. The rest of the app depends on the interface, never on `db` directly.
  The `overlays` table arrives with step 24.
- **Watch out:** IndexedDB doesn't exist during the static build: create `db` lazily (on first use in
  the browser), never at module top level in code a Server Component imports.
- **Check:** repository tests pass: create, read, add frame, delete project with cascade.

### 07 · Save captures and survive a refresh
- **Builds:** capture saves image + thumb + frame and appends to `project.frameIds` in **one
  transaction** (`repository.insertFrames`). `watchProject()` on the repository (Dexie `liveQuery`
  underneath, in the contract tests) feeds every saved change into the store through `syncProject`.
  `repairFrameOrder()` *(core)*. The studio creates a project when `?project=` is missing and puts its
  id in the URL; an unknown id shows "This animation isn't here".
- **Decisions:** Dexie is the source of truth for the project; Zustand mirrors it plus holds transient
  state. A load step repairs drift: ids in `frameIds` with no frame are dropped, frames missing from it
  are appended.
- **Watch out:** the first update arrives after the page renders; render a loading state.
  Replace the URL (`router.replace`), don't push, or Back leads to an empty studio.
- **Check:** capture, refresh, the pictures are still there; open the same project in two tabs and
  capture in one, the other updates.

### 08 · End-to-end tests with Playwright
- **Builds:** `@playwright/test` and its browsers (Chromium, WebKit). `playwright.config.ts` with a
  `webServer` that builds the static export and serves `out/` on port 3200, and two projects:
  **chromium** (with the browser's own fake camera) and **webkit** (a script-faked camera; capture tests
  skip themselves in WebKit builds without media streams, such as Playwright's WebKit on Windows). `e2e/fake-camera.ts`, run as global
  setup, writes a short `.y4m` video of a coloured shape sliding across a background into an ignored
  folder, and Chromium plays it as its webcam. First tests: `e2e/camera.spec.ts` (turn on → live picture,
  off → track stopped, blocked camera → the blocked message) and `e2e/persistence.spec.ts` (capture 3,
  reload, still 3; a second project doesn't see them). Scripts `test:e2e`, `test:e2e:ui`,
  `test:e2e:report`; `test-results/` and `playwright-report/` in `.gitignore`.
- **Decisions:**
  - **Vitest stays** for logic (fast, precise, hundreds of edge cases); Playwright covers the few flows a
    child actually goes through, in a real browser, with real IndexedDB and a (fake) camera.
  - **Test the production build**, not `next dev`: it's what ships, and it avoids the dev overlay and
    Strict Mode's double effects. `reuseExistingServer` keeps reruns quick.
  - **Find things the way people do**: `getByRole("button", { name: "Take a picture" })`, `getByLabel`,
    `getByText`, never CSS classes. If a test can't find a button by its name, a screen reader can't
    either, so the tests double as a basic accessibility check. `data-testid` only where there is no
    accessible name (e.g. counting thumbnails).
  - **Every test starts empty**: each gets a fresh browser context, so its own empty IndexedDB and
    `localStorage`. No test depends on another's leftovers or order.
  - **Generate the fake camera video, don't commit it**: raw `.y4m` is about 350 KB per frame, too big
    for git, but a few lines of Node write it in under a second.
- **Watch out:** `npx playwright install chromium webkit` downloads a few hundred MB once per machine.
  The fake-camera flags are Chromium-only (Firefox needs `media.navigator.streams.fake`, WebKit has no
  file-backed camera), so camera tests run only in the chromium project. Grant the camera with
  `permissions: ["camera"]` as well as the flag. Assert on counts, sizes and states, not on pixels of
  captures: the fake video moves, so two captures are never identical. Never use `waitForTimeout`; rely
  on auto-waiting and `expect(...).toBe...` retries. The `.y4m` path must be absolute on Windows.
- **The step page explains, from scratch:**
  - what an end-to-end test is, and how it differs from the Vitest unit tests (with a side-by-side of
    the same idea tested both ways);
  - how Playwright drives a browser: the runner starts real browser binaries and talks to them over
    their automation protocols; the hierarchy **browser → context → page**, and why a new context per
    test means a clean slate;
  - the test runner itself: `test()`, `expect()`, `test.describe`, hooks, and **fixtures** (the `page`
    argument, and how to write a custom one, e.g. `studio` that opens `/studio` with the camera on);
  - **locators and auto-waiting**: why `page.getByRole(...)` waits for the element to be visible,
    enabled and stable before clicking, and **web-first assertions** (`await expect(locator).toHaveCount(3)`)
    that retry until they pass or time out, which is what makes the tests reliable without sleeps;
  - `playwright.config.ts` line by line: `webServer`, `use` (base URL, permissions, trace), `projects`,
    `launchOptions.args` for the fake camera;
  - the fake camera: the three Chromium flags, what the `.y4m` format is (a header, then raw YUV frames),
    and how `e2e/fake-camera.ts` writes one;
  - the tools for writing and debugging: `--headed` to watch, **UI mode** (`npm run test:e2e:ui`) to run
    tests one by one with a timeline, the **trace viewer** for failed runs (every action, DOM snapshot,
    console and network), **codegen** (`npx playwright codegen`) to record clicks into test code, and
    the HTML report;
  - how later steps use it: each step with a user-facing flow adds or extends a spec and names it in
    its review checklist.
- **Check:** `npm run test:e2e` passes in both projects; rename the "Take a picture" button and the test
  fails with a clear "locator not found" message; open the trace of that failure and step through it.

### 09 · Projects page
- **Builds:** `/` lists projects (newest first, first-frame thumbnail, picture count), create, rename,
  delete (confirm dialog), open. Calls `navigator.storage.persist()` on the first project. Small storage
  meter from `navigator.storage.estimate()`.
- **Decisions:** delete is the one non-undoable action, so it confirms with the project name and
  thumbnail. Deleting cascades images/thumbs/frames in one transaction.
- **Watch out:** `persist()` may resolve `false` silently (Firefox may prompt, Safari often declines);
  never block on it. `estimate()` numbers are estimates; label them as such.
- **Check:** create three projects, delete one, storage meter goes down.

---

## Part 4 - Timeline

The timeline is **time-scaled**: a picture's width is its duration, a faint seconds ruler runs along the
top, the edge of a picture can be dragged to change how long it stays, and pictures are reordered by
dragging. Step 24 adds a second layer under the pictures for text and shapes.

### 10 · Time-scaled timeline and seconds ruler
- **Builds:** `core/model/timing`: ticks ↔ ms ↔ px conversion and the start tick of every frame
  *(core)*. `Timeline` with a picture track whose thumbnails are `hold` ticks wide (`pxPerTick` from a
  zoom level), a seconds ruler (faint tick marks every second, labels every few seconds, finer marks when
  zoomed in), click to select, arrow keys to move the selection, auto-scroll to the selection, the
  "camera" slot at the end. Thumbnail URLs keep coming from the image cache (step 05). Zoom in/out buttons and
  Ctrl/Cmd+wheel.
- **Decisions:** the ruler is drawn in CSS (a repeating gradient sized from `pxPerSecond`) plus a few
  absolutely positioned labels, not one DOM node per tick. The track is a `role="listbox"`. Thumbnails
  are cover-cropped and repeated when a picture is wider than one thumbnail. Zoom is UI state (Zustand),
  not saved in the project.
- **Watch out:** at high speeds a 1-tick picture is narrow; keep a minimum visual width and a hit area of
  at least 56 px tall. Labels must stay faint (`--color-muted`, low contrast lines) so the
  pictures stay the focus.
- **Check:** at 8 fps, a 1-tick picture is 1/8 of a second-mark wide; zooming keeps the selection in
  view; 100 frames scroll smoothly.
- **Changed later:** each animation remembers its own zoom (`useTimelineView`). One opened here for
  the first time (new, restored, a demo) starts at the last zoom chosen anywhere, or, before any
  was chosen, at its pictures' true shape (`trueShapeZoom`: a one-tick picture as wide as its
  shape makes it at the track's height). The tests start at 160 px a second (`startZoom` in
  `e2e/fixtures.ts`).

### 11 · Commands and undo/redo *(core)*
- **Builds:** `core/commands`: `Command` type, `History` (undo/redo stacks, limit 100), `runCommand()`
  that executes against the repository and pushes to history. First command: `DeleteFrames`. Undo/redo
  buttons, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z.
- **Decisions:** commands store just enough to reverse themselves (e.g. the deleted frames and their
  positions). Deleting a frame never deletes its image (see step 21), so undo is always possible. History
  is per open project and in memory only.
- **Watch out:** a command must be atomic: one Dexie transaction per `do()`/`undo()`. A new command
  clears the redo stack.
- **Check:** delete 3 frames, undo, they return in place; tests cover do → undo → redo round-trips.

### 12 · Frame operations
- **Builds:** `cloneFrame(frame)` *(core)*; `DuplicateFrames` (inserts the copies right after their
  source and selects them), `InsertCaptureAt` (the next capture goes after the selected frame),
  multi-select with Shift/Ctrl, toolbar buttons.
- **Decisions:** **a duplicate looks exactly like its source**: same `imageId`, and copies of `hold`,
  `transform`, `adjust` and (from step 23) `elements`, with new ids for the frame and each element. Only
  the id is new. Sharing the image instead of copying the blob is cheap, and it's one way to make a pause.
  (The other, resizing, is step 13.)
- **Watch out:** copy nested objects (`{ ...frame.transform }`, elements one by one), never share them, or
  moving the copy later moves the source too. Every new field added to `Frame` must be added to
  `cloneFrame()`; a test compares a clone to its source field by field so a forgotten field fails.
  Inserting must update the selection to the new frame, or the next capture lands in the wrong place.
- **Check:** move and brighten a picture, duplicate it, the copy is identical on the stage and in
  export; move the copy, the source stays put. Storage meter doesn't grow on duplicate.

### 13 · Resize a picture's duration
- **Builds:** a grip on the right edge of each picture. Dragging it changes `hold`, snapped to whole
  ticks (minimum 1), with a live "1.5 s" bubble while dragging; everything after it slides along.
  `SetHold` command, one per drag. Keyboard: `[` / `]` shorter / longer for the selection. Dragging with
  several pictures selected resizes them all by the same amount.
- **Decisions:** the grip uses pointer events with `setPointerCapture`, separate from the reorder drag,
  so resizing never starts a reorder. During the drag the new `hold` lives in Zustand and only
  `pointerup` writes a command. Snap is to ticks, so durations stay whole multiples of `1/fps` and the
  speed control keeps scaling them evenly.
- **Watch out:** the grip must be wide enough for a finger (≥ 24 px hit area, visually thinner). With
  overlays (step 24) a picture getting longer shifts later pictures, not the overlays: show that clearly.
- **Check:** drag a picture from 1 to 4 ticks, the ruler shows it at the right length, playback holds it
  4× as long, one undo restores it.

### 14 · Drag to reorder
- *Built differently (see the step page): own pointer drag instead of dnd-kit, Ctrl/Cmd+arrows for the keyboard.*
- **Builds:** `@dnd-kit/sortable` on the picture track with pointer, touch and keyboard sensors and
  `horizontalListSortingStrategy` (it handles items of different widths); `ReorderFrames` command on drop.
- **Decisions:** an activation distance (~8 px) so a tap still selects. Only the final drop creates a
  command; dragging itself doesn't touch Dexie. The drag starts from the picture body, never the grip.
- **Watch out:** horizontal auto-scroll while dragging near edges; dragging a multi-selection moves the
  whole group; wide (long) pictures make drop positions jumpy, so the drag overlay shows a compact
  thumbnail.
- **Check:** reorder with mouse, finger (DevTools touch) and keyboard; undo restores the order.

---

## Part 5 - Playback

### 15 · Renderer *(core)*
- **Builds:** `core/render/renderAt(ctx, scene, time)`: finds the frame on screen at `time`, letterboxes
  it into the canvas, applies transform (translate, rotate, scale, flip) and adjust. Elements and
  overlays plug in here in steps 23-24. `adapters/render/BitmapCache`: decodes Blobs to `ImageBitmap` on
  demand with an LRU limit (e.g. 30 bitmaps) and `close()` on eviction. The stage shows the selected
  frame through it. **Vitest browser mode** (`@vitest/browser` with the Playwright provider, reusing the
  Chromium from step 08) for `*.browser.test.ts` files: renderer pixel tests that draw a known image
  with a known transform and check pixel colours at chosen points.
- **Decisions:** one renderer for stage, playback, onion skin and export, so preview matches the file.
  It takes a time, not a frame index, because overlays live in time. The canvas has the project's
  resolution; CSS scales it to fit. Pixel tests use small synthetic images (solid quadrants), so
  expected colours are exact and don't depend on photos or fonts.
- **Watch out:** `ImageBitmap`s use memory outside the JS heap; forgetting `close()` leaks fast. Set the
  canvas backing size for `devicePixelRatio` only on the stage, not for export. Keep browser tests in
  their own file pattern and Vitest project, so `npm test` stays fast and Node-only. Allow ±1-2 for
  colour values at edges (anti-aliasing).
- **The step page explains:** what browser mode is and how it differs from both Node Vitest and
  Playwright end-to-end tests; the workspace/project config that splits the two Vitest runs; how to read
  pixels (`getImageData`) and write a tolerant colour assertion.
- **Check:** select frames quickly; memory stays bounded in DevTools > Memory; `npm run test:browser`
  passes, and flipping the transform maths makes a pixel test fail.

### 16 · Playback
- **Builds:** `core/playback/Clock` using `requestAnimationFrame` and elapsed time (no `setInterval`),
  counting ticks so `hold` is honoured. A playhead line on the timeline that follows playback and can be
  dragged to scrub. Play/pause (big button, Enter), speed control (5, 8, 10, 12, 15 fps shown as
  "slow ... fast"), loop toggle, preloading the next few bitmaps.
- **Decisions:** the clock is pure TS and takes `now()` as input, so it's unit-tested with fake time.
  Playback reads frames from the store snapshot taken at play time. Changing speed rescales the whole
  timeline (ruler included), because everything is in ticks.
- **Watch out:** rAF pauses in background tabs; recompute from elapsed time when it resumes instead of
  fast-forwarding. Stop playback when the camera captures. Keep the playhead in view while playing.
- **Check:** 24 one-tick frames at 12 fps take 2 s (stopwatch or test); dropped frames don't change
  duration; the playhead lines up with the ruler.

### 17 · Onion skin ("see-through")
- **Builds:** in camera mode, the previous 1-3 frames drawn over the live video at adjustable opacity
  (default 40%), with a toggle. Stage modes become explicit: `camera`, `frame`, `playing`.
- **Decisions:** the overlay is a canvas above the `<video>`, drawn with the same renderer. Implemented
  directly here; it moves to its own feature folder in step 22.
- **Watch out:** the overlay must use the same cover-crop as the live `<video>` (step 03), or the ghost
  and the camera picture won't line up.
- **Check:** move a toy and line it up with its ghost.
- **Changed later:** See is **off** in a new animation (and in a restored backup or demo); turned
  on, it's remembered for that animation.

---

## Part 6 - Editing

Pictures need to be **quick to move and precise to line up**: when the camera or the set gets bumped
between shots, a child should be able to drag a picture back into place, then fine-tune it against its
neighbours. Step 18 is moving; step 19 is lining up.

### 18 · Move, scale, rotate, flip
- **Builds:** direct manipulation on the stage: drag to move, wheel / pinch / `+` `-` to scale **around
  the pointer** (or the centre from the keyboard), a rotate handle, flip buttons, "reset". Precise
  input: arrow keys nudge 1 project pixel (Shift: 10), the properties panel has steppers and number
  fields for x, y, size and angle. `TransformFrames` command; with several pictures selected, they move
  together.
- **Decisions:** two zooms that never mix: **view zoom** (look closer at the stage, in Zustand, not saved)
  and **picture scale** (part of the frame's transform, saved and exported). Nudges are in project pixels
  and converted to the stored fractions, so one arrow press is the same visible step at any view zoom.
  During a drag the transform lives in Zustand and the stage redraws from it; one command is written on
  `pointerup`, and a burst of arrow presses on the same picture merges into one undo step.
- **Watch out:** use pointer events with `setPointerCapture`, not mouse + touch events. Scaling around
  the pointer means changing `x` / `y` too, or the picture slides away from the cursor (test the maths).
  Rotation around the frame centre, not the canvas origin. Dragging must feel immediate: redraw on
  `requestAnimationFrame`, not on every pointer event.
- **Check:** drag a frame, undo returns it in one step (not 60); 10 arrow presses move it exactly
  10 px in the exported file; zoom the view to 400% and nudge, the picture moves 1 px, not 4.

### 19 · Line up with other pictures
- **Builds:** "Spot the difference", a see-through look beside "Outline only": the picture before is
  blended over the current one so that everything that lines up turns black and misalignment glows,
  over the live camera too. Snap guides while dragging, to the stage's centre and edges and to the
  see-through picture. A view zoom on the stage (Ctrl + wheel or a trackpad pinch, around the
  pointer) with panning (Space-drag or the middle button), remembered per animation. *Removed
  later:* the view zoom scaled the safe zone with the picture, across every picture; a pinch and
  Ctrl + wheel now size the picture, like the wheel.
- **Decisions:** see-through is the one ghost, with three looks (photo, outline only, spot the
  difference), drawn by the onion-skin renderer from step 17 with each picture's own transform; the
  difference is a CSS blend (`mix-blend-mode: difference`), so it works over the `<video>` as well
  as a picture. Snapping is on by default with a small threshold and off while Alt is held.
  *Simplified in this step:* a separate line-up section in the Picture tab (the picture after or a
  chosen one, a zoom slider with Fit and 100%, "copy position" buttons) was built, then removed as
  duplicating see-through. See `public/steps/19-line-up.html`.
- **Watch out:** the ghost must be drawn with *its own* transform, not the selected picture's. Snap
  guides must not fight arrow-key nudges (snap only during drags). The difference view is a looking
  aid; never export it.
- **Check:** shift a picture by hand, tick "Spot the difference", nudge until the background goes
  black; zoom in and nudge, the picture moves one video pixel.

### 20 · Brightness and contrast
- **Builds:** two sliders in the panel, `AdjustFrames` command, "apply to all" button. The renderer
  applies them with `ctx.filter`, with a pixel-loop fallback.
- **Decisions:** non-destructive: the original photo is never changed. "Apply to all" is one command, so
  one undo.
- **Watch out:** check `ctx.filter` support in the target Safari version and keep the fallback tested.
  The pixel fallback is slow at 1080p; run it only for the stage and export, not during slider drags.
- **Check:** adjust, undo, export later shows the same result as the stage.

### 21 · Storage safety
- **Builds:** image garbage collection (delete images/thumbs no frame references) on project open and
  after history is cleared; `QuotaExceededError` handling with a kid-friendly message; storage warning
  at 80%; "storage" section in the projects page.
- **Decisions:** GC never runs while undo history could still need an image.
- **Watch out:** test GC against duplicated frames (shared images) so a shared image is never deleted.
- **Check:** delete frames, close and reopen the project, storage drops; fill quota in a test profile
  and see the message instead of a crash.

---

## Part 7 - Extension points

### 22 · Plugin registry *(core)* → feature folders
- **Built:** each feature's code in its own folder in `src/features/` (`camera/`, `picture/`,
  `onion-skin/`), imported and placed directly in `Studio.tsx`. The safe zone slider moved to the Play
  options.
- **Changed in this step:** a plugin registry (panels, stage tools and layers, controls, exporters,
  frame sources, element kinds registering themselves) was built, then removed. It decided the layout
  for the features, so moving a piece of UI for a UX experiment needed a new slot or a special case;
  direct composition makes it a cut and paste. Lists stay only where there are many items of one kind
  shown alike: element kinds (step 23), exporters (step 25). See `public/steps/22-plugin-registry.html`.
- **Decisions:** nothing is ever loaded from outside (a kids' app). Features change projects only via
  the commands the studio passes them, and read only via the store.
- **Check:** everything works as before; removing a feature is deleting its import and its lines in
  `Studio.tsx`.

---

## Part 8 - Elements: speech bubbles, text and shapes

### 23 · Speech bubbles on pictures
- **Builds:** the `Element` type and `Frame.elements` *(core)*; an element editing layer on the stage
  (select, move, resize with corner handles, rotate, delete, type text in place); the
  `speech-bubble` kind as the first entry in a plain list of element kinds (rounded bubble, draggable tail point, a
  "thought" variant). `AddElement`, `UpdateElement`, `RemoveElement` commands. The renderer draws a
  frame's elements on top of the picture. A small badge on timeline thumbnails that have elements.
- **Decisions:** elements belong to their picture: reordering or duplicating a picture carries its
  bubbles along. Boxes are fractions of the frame, like transforms. Text is edited in a real
  `<textarea>` positioned over the canvas, then drawn to the canvas when editing ends, so export matches.
  Element editing and picture moving (step 18) are separate stage tools.
- **Watch out:** canvas text has no wrapping: write a small word-wrap helper and test it. Fonts must be
  loaded before drawing (`document.fonts.ready`), or the first export uses a fallback font. Keep a
  bubble readable at GIF size (minimum font size relative to frame height).
- **Check:** add a bubble to picture 3, move picture 3 to the start, the bubble goes with it; export
  later shows it.
- **Changed after the step:** bubbles became the first kind of *object*, in an **Objects** tab:
  icons dragged onto the picture, and below them the picked object's settings (a bubble: shape
  speech / thought / spiked, tail on or off, colour, outline and its colour, text, text size, font,
  text colour); position, size and turn are set only on the stage. Text is typed in the tab
  instead of over the canvas. The tab's heading is now **Add extras**.

### 24 · Overlay layer: text and shapes in time
- **Builds:** the `Overlay` type and an `overlays` table (Dexie version 2) *(core + adapter)*; a second
  track under the pictures where an overlay is a coloured bar from `start` to `start + length`; drag a
  bar to move it in time, drag its edges to change when it starts and ends, both snapping to ticks; the
  `text`, `rectangle`, `ellipse` and `arrow` element kinds; the renderer draws every overlay active at
  `time` above the picture and its elements. `AddOverlay`, `MoveOverlay`, `ResizeOverlay`,
  `UpdateOverlayElement`, `RemoveOverlay` commands.
- **Decisions:** overlays are anchored to time, not to pictures (PLAN §3): moving or resizing pictures
  doesn't move them. Overlapping overlays on the one track stack by start time; more tracks are a
  `track` number away but not built. The stage editing layer from step 23 edits overlays too; it only
  shows the ones active at the playhead.
- **Watch out:** the resize grips of pictures and of overlays sit close together; give each track its
  own row height and hit areas. An overlay can end past the last picture: show it, and clamp export to
  the longer of the two. Delete-frame undo must not touch overlays.
- **Check:** add a title from 0 s to 2 s, change the speed, it still covers the same pictures; drag
  pictures around, the title stays at 0-2 s.
- **As built:** an object goes in time by dropping its Objects tab icon on the track; rectangle,
  ellipse and arrow are one configurable **Shape** kind; overlays are a list on the project
  (`Project.overlays`), not a Dexie table, so no migration; one `setOverlays` command instead of
  five. Playback still ends at the last picture; export should run to the later end.
  The timeline has one selection: pictures, or one bar; the toolbar's Duplicate and Delete act on it.


### 24b · Free drawing on pictures *(added)*
- **Builds:** a Draw tab (pencil or eraser, colour, four widths, Clear drawing; all remembered) and a
  drawing layer on the stage; the `drawing` object kind *(core)*: one per picture, holding its
  strokes in its own box; `simplifyStroke` (jitter out, needless points dropped), `addStroke`,
  `eraseStrokes` *(core, tested)*; `drawDrawing` with smooth curves *(render, pixel-tested)*.
- **Decisions:** a drawing is an ordinary object, so thumbnails, see-through, playback, export,
  copying and undo come with it, and the Objects tab moves, sizes and deletes it as one. Each line,
  each erase and Clear drawing is one undo step. The eraser takes whole strokes.
- **Later:** drawing on the time track (a drawing that lasts over several pictures): the model
  already allows it (PLAN.md §3); the Draw layer would target an overlay the way the Objects tab
  does (`Placed`).
- **Check:** draw, see it in the thumbnail; erase one line; undo; reload: tool, colour and width are
  as left.
---

## Part 8b - Design system page *(added)*

A page of its own, `/design`, showing every UI element the studio uses, in a gallery, with no
behaviour: something to look at and tune. A floating panel changes the design tokens (colours,
sizes, radii, lines, type) and every element on the page follows straight away. Tweaks stay in the
browser until Reset; a **Copy changes** button gives them as a message to paste into the chat with
Claude, which makes them permanent in the code.

**Stand-alone, as far as it can be.** The page lives in a folder of its own,
`src/design-system/`, with its own route, its own SCSS for the page and the panel, its own token
list and its own storage key. It doesn't use the studio's store, `remembered.ts`, the undo history,
IndexedDB or the camera, and the studio doesn't import anything from it. The only things it takes
from the app are what it exists to show: `globals.scss` (the tokens) and the components and their
styles. Removing the folder and its route removes the page, and nothing else changes.

### D1 · The gallery page
- **Builds:** a route `src/app/design/` that renders `src/design-system/DesignPage.tsx`: a long,
  vertically scrolling page of sections, each a labelled specimen of the real thing:
  - **Tokens:** every colour swatch with its name and value, light and dark; spacing, radii, line
    widths, the hit size, the type sizes.
  - **Controls:** `icon-button` (normal, hover, on, disabled, small, danger), the capture
    `big-button`, selects, text fields, sliders, the checkbox, colour swatches with "None", the
    width buttons, the Objects tiles.
  - **The side panel:** tab ears (open and pushed back), a panel with its title, a settings card
    with its groups, hints, the soft scrollbar.
  - **The stage:** the stage frame, the safe zone, the object handles, the drawing ring, the
    camera message.
  - **The timeline:** pictures (selected, on the stage, a long one), the grip and its length
    bubble, the ruler, the playhead, overlay bars in rows, the next-picture slot.
  - **Bars and menus:** the playback bar, a dropdown open, the storage notice, a project card, the
    delete dialog.
- **Decisions:** specimens use the real components where they take their data as props, and the
  same markup and class names where a component needs the studio's store, so every style is the
  one the studio uses and nothing is copied into the page's CSS. Fixed demo data; nothing on the
  page does anything. Placed by hand in JSX, one section after another (direct composition), so
  moving or adding a specimen is moving or adding a line.
- **Watch out:** many styles are scoped under `.nsc-studio`, a full-screen grid with
  `overflow: hidden`. Specimens sit in an `.nsc-studio.is-specimen` wrapper that resets the grid,
  height and overflow, and nothing else. Development only at first (the build left the page out);
  *later* public on the live site, linked from the home page's Settings, its token panel folded at
  first.
- **Check:** every section renders with no console errors; the page scrolls to the end; dark mode
  shows the dark tokens. `e2e/design.spec.ts`.

### D2 · One list of tokens
- **Builds:** `src/design-system/tokens.ts`: every token with its group (colour, space, radius,
  line, type, size), its kind (colour, length, number), its light and dark values, and a line on
  what it's for. A unit test holds it to `globals.scss`: every token there is in the list and the
  other way round, with the same values, so the list can't drift. Values still written straight
  into feature SCSS that should be tokens (shadows, odd sizes, fixed colours) become tokens first.
- **Decisions:** written by hand, not parsed at runtime: it carries the grouping and descriptions
  the panel needs, and the test keeps it honest. The gallery's token tables (D1) read it.
- **Check:** `npm test` fails if a token is added to `globals.scss` and not to the list.

### D3 · The floating tweak panel
- **Builds:** a panel floating over the gallery, dragged by its title bar, opened and closed with
  Shift+T or a button: the tokens in their groups (from D2), each with a control for its kind (a
  colour picker with its hex, a slider with a number and unit), a filter by name, light / dark
  (which scheme is shown and edited), and reset for one token. A change sets the custom property
  on the gallery's root at once, so every specimen follows.
- **Decisions:** the look of the kits in the other repos (`effects-collection/randomize-studio/
  type-kit/kit-shell.css`, the type and texture kits), copied into `src/design-system/`, never
  linked out (workspace rule). The panel lives in a shadow root, so the tokens being tuned don't
  restyle the panel itself. Only the gallery is changed, never the studio.
- **Check:** changing `--color-border` restyles every border on the page and not the panel; its
  reset brings it back.

### D4 · Keeping tweaks, and handing them over
- **Builds:**
  - **Kept in the browser until Reset:** every tweak is saved as it's made (the page's own
    `localStorage` key, not the studio's) and comes back after a reload, until **Reset all** is
    pressed. Changed tokens are marked in the panel, with a count.
  - **Copy changes:** copies a message ready to paste into the chat with Claude, for example:
    ```
    Design-system tweaks for stop-motion-studio: please make these permanent in
    src/styles/globals.scss (light theme in :root, dark theme in the prefers-color-scheme block):
    - --color-border (light): #b5ab9b -> #9d927f   (outlines of panels, controls and cards)
    - --radius-small (light and dark): 0.625rem -> 0.5rem
    - --color-focus (dark): #7d9bff -> #8fa8ff
    ```
    Each line names the token, which theme, the value it had and the new one, and what the token is
    for (from D2), so the change can be made, and checked, from the message alone.
- **Decisions:** the message is made by a pure function (tweaks to text), unit-tested, and lists
  only what really changed (a token set back to its value is left out). Nothing is written to the
  repo by the page: the permanent change is made in the code, from the message, and then the page's
  Reset all clears the tweaks it no longer needs.
- **Check:** change two tokens, reload: they're still there; Copy changes gives exactly those two,
  each with its theme, old and new value; Reset all clears them and the copy is empty.

### D5 · The cardboard look *(added, after step 30)*
- **As built:** the home page and the studio are cut from cardboard, like the sets kids build:
  pieces of the cardboard letters font's own photos (synced in with `npm run sync:cardboard`),
  with paper pasted on them. One set of mixins in `src/styles/_cardboard.scss` (`cardboard()`,
  `cardboard-paper()`, `cardboard-button()`, `cardboard-split()`) cuts every piece.
  - **Home page:** the title in cardboard letters on a five-piece cardboard burst (each piece and letter edged as seen from a little above: a thick cut face along the bottom, a sliver along the top), the New, open-a-backup and Settings buttons, and the
    animation cards, shown frame by frame as a short stop-motion intro (not when coming back from the
    studio, not with reduced motion); the storage meter moved into a Settings window.
    *Later:* the animations' column goes round (`useEndlessScroll`, tablet width and up, however
    few animations there are): copies of the list before and after the real one, enough to fill
    the window (one a side for a long list, more for a short one), put back one list's height whenever the view's middle leaves the real list, so past the last animation
    come the first again with nothing moving on screen. The wheel and a finger both drive it (the
    page follows the finger itself, `touch-action: none`, so Safari's momentum can't fight it; a
    flick carries on in a few shrinking jumps, 80 ms apart). The copies are clickable but hidden
    from screen readers and the keyboard; tests count only the real cards.
  - **Studio:** the back arrow, Save and Help in a column beside the stage; Play and See (each
    joined to its options arrow); the stage on cardboard with a white paper border; the side panel
    and its tabs, reaching down to the timeline; the timeline as bare cardboard from edge to edge,
    its tools a tab cut at 45°. The playhead and the selection are one red block behind the selected
    pictures, with a chunky grip; the ruler's gradations are a setting (Layers menu), off at first.
  - **Changed after the step (studio UI):** a new animation starts with all three Layers off (the
    objects row, the sound row, the gradations); adding or dragging an object or a sound shows its
    row. After the last picture, a dashed square with a + and "Insert frame" adds an empty picture.
    The timeline's first tool, **Minimize** / **Maximize** (remembered for every animation), makes
    the pictures a third as tall and zooms two steps out (and back in); the extra rows keep their
    height. Play stays pressable with no pictures (it does nothing). Lists that open downward open
    upward when the window has no room below (`useDropdown`). More room above the studio
    (`--studio-top`) and round Play and See.
  - **Design system page:** a Cardboard section after the tokens (the pieces, the buttons beside the
    stage, Play and See); the old top toolbar and plain split-button specimens are gone, and with
    them two tokens nothing used (`--shadow-card`, `--color-faint`).
- **Decisions:** square, no easing (hover and press jump between poses, as in stop motion); white
  paper goes a shade darker under the pointer, coloured paper lighter. Shadows that hold anything
  fixed to the window (the timeline, the side panel) are box shadows, not filters.
- **Check:** `e2e/design.spec.ts` (every section, Cardboard included); the stage, timeline and
  playback specs for the playhead block and the grip.

---

## Part 9 - Export and import

**All exports (GIF and video) crop to the safe zone:** `exportRect(project, safeMargin(project))` in
`core/render/safeZone.ts` (each animation's own margin, 0-60 project px, 20 by default, set from the
playback options; even width and height). The margin comes off the short sides and as large a
share off the long ones, so the file keeps the picture's shape (1208 × 680 of 1280 × 720, step 25).
The stage shows that band veiled with a dotted line (added after step 18), so what's inside the line
is exactly what the file contains. Test it: a pixel test that the exported frame's corners come from
inside the band.

### 25 · GIF export
- **Builds:** `features/gif-export`: renders each tick range with the shared `renderAt` onto an
  `OffscreenCanvas` in a Web Worker, encodes with `gifenc`, honours `hold` and overlays, shows progress,
  downloads the file. Size options (small/medium).
- **Decisions:** GIF is the first export because it plays everywhere and kids can share it. Default
  width 640 px to keep files small. A new GIF frame is emitted only when the picture or the set of active
  overlays changes, with the matching delay.
- **Watch out:** transfer `ImageBitmap`s to the worker (transferable), don't copy pixel arrays. GIF has
  256 colours per frame: quantise per frame for photos. Long projects make big GIFs; warn above ~20 MB.
  Text drawn in a worker needs the font loaded there too (`FontFace` in the worker).
- **Check:** export 30 frames with a bubble and a title, open the GIF in another app, timing matches
  playback.

### 26 · Video export
- **Builds:** `features/video-export` with Mediabunny: MP4 (H.264) or WebM (VP9) depending on
  `VideoEncoder.isConfigSupported`, progress, download. The button is hidden when unsupported.
- **Decisions:** stretches where nothing changes (a held picture, no overlay starting or ending) are
  encoded as one frame with a longer duration, not repeated. No FFmpeg.wasm.
- **Watch out:** WebCodecs support differs across browsers and versions; detect, don't sniff the user
  agent. Even dimensions are required by H.264.
- **Check:** exported video plays in the OS player at the right speed.

### 27 · Project archive (backup and restore)
- **Builds:** export a project as `.zip` (`project.json` with `schemaVersion`, frames, elements and
  overlays + `images/*.jpg`) with `fflate`; import validates, assigns new ids if the project already
  exists, and regenerates thumbnails.
- **Decisions:** the archive format is the stable public format; Dexie's schema can change behind it.
  Import is all-or-nothing in one transaction.
- **Watch out:** never trust imported JSON: validate types and sizes, cap the number of images and
  elements, and drop element kinds this version doesn't know.
- **Check:** export, delete the project, import, everything (order, durations, transforms, bubbles,
  overlays) is back.
- **Changed after the step:** Settings has **Download all animations**: one `.zip` (`All animations
  <date>.zip`) holding each animation's own backup, names kept apart (`uniqueFileNames`).
  Load project (its title now "Open .zip project") takes either kind; a bundle restores every
  animation in it, each all or nothing, and says how many couldn't be. Settings closes with an X in
  its corner instead of a Close button.
- **Demo animations (added):** `public/demos/demos.zip`, a backup of all animations (Arlequin,
  Names, Paper animation) with the photos re-saved at JPEG quality 80 (8.5 MB to 4.2 MB, still
  1280×720). On a browser's first visit to the home page, once the page shows, it's restored like
  any backup (`src/projects/demos.ts`), remembered (`demos-added`) only once it's in; deleted demos
  don't come back (a Settings button to add them again was tried, then removed). Kept out of the offline worker's first
  download. Tests start without them (`withDemos` in `e2e/fixtures.ts`); `projects.spec` checks
  them. To change the demos: make a new backup, re-save its photos, replace the file and deploy
  (browsers that had the old ones keep them).

### 28 · Import photos
- **Builds:** `features/photo-import` as a `FrameSource`: file picker and drag-and-drop onto the
  timeline; images resized to the working resolution, thumbnails made, inserted after the selection in
  one command.
- **Decisions:** same pipeline as capture after the Blob exists, so the timeline doesn't care where a
  frame came from.
- **Watch out:** HEIC from iPhones may not decode in every browser; show a clear message. Respect EXIF
  orientation (`createImageBitmap` with `imageOrientation: "from-image"`).
- **Check:** import 10 photos of mixed sizes; one undo removes them all.

---

## Part 10 - Kids, polish and shipping

### 29 · Kid-friendly capture
- **Builds:** countdown timer (off, 3, 5, 10 s) with big numbers, capture flash and a small celebration,
  picture counter ("You've made 12 pictures!"), optional sounds with mute, plain-language labels with
  real terms in tooltips.
- **Decisions:** celebrations are short (<1 s) and never block the next capture. Sounds have their own
  toggle; animations respect `prefers-reduced-motion`.
- **Watch out:** autoplay rules: sounds only start after a user gesture.
- **Check:** a 7-year-old can make a 10-frame animation without help (the real test).
- **As built (cut down on request):** only the capture sound: a short synthesised shutter click when
  a picture is saved, on at first, with a Sound on/off button in the Camera tab (remembered). No timer,
  celebration or new count wording: not needed for now.

### 29b · Sound track: sound effects in time *(added)*
- **Builds:** a third timeline row, at the **bottom**, under the overlay track: a sound is a bar from
  `start` for as long as it plays, like an overlay. A **Sounds** tab in the side panel lists a
  starter library by category (cartoon, animals, vehicles, nature, magic, people, music stingers...)
  with a play button on each; drag one onto the sound row (or press it to put it at the playhead).
  On the stage nothing shows. Playback plays each sound when the playhead reaches it; the video
  export mixes them into an audio track (the GIF stays silent). Undoable like overlays: one
  `setSounds` command.
- **Data:** `Project.sounds: SoundClip[]` with `{ id, start, sound, volume }` (ticks, like overlays).
  `sound` names a library entry (`"cartoon/boing"`), so the project stays small and the archive
  needn't copy library files; a child's own recording later is a `StoredSound` blob referenced the same
  way. The bar's length comes from the sound's duration in ticks, so changing the speed changes how
  many pictures it covers but not how long it sounds.
- **Library:** about 100 short effects, CC0 where possible, bundled in `public/sounds/` as small OGG/MP3
  files with a `sounds.json` (id, name, category, seconds, licence, source). Candidates and licences:
  [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Decoded once with `decodeAudioData` and cached, like bitmaps.
- **Decisions:** sounds are anchored to time, not to pictures (same rule as overlays). One sound row,
  with overlapping sounds stacked in lanes like overlays. Volume per clip (quiet, normal, loud), no
  fades. The capture shutter (29) stays a UI sound, never in the animation.
- **Watch out:** browsers only play sound after a press (Play is one). Playback has to schedule
  sounds on the audio clock, not on timers, or they drift from the pictures. Starting playback in
  the middle of a sound starts it part-way. Export: Mediabunny's `AudioBufferSource` with an
  `OfflineAudioContext` render of the whole mix; check MP4 (AAC) and WebM (Opus) encoders exist,
  otherwise export without sound and say so. Library licences must allow bundling without per-video
  credit; keep the source and licence of every file in `sounds.json`.
- **Check:** add a boing at 1 s and a moo at 2 s, play: they sound at the right pictures; change the
  speed, they keep their seconds; export a video, the sounds are in it; undo removes a sound.
- **As built:** the library is 18 sounds made by the synthesiser (no files yet), in four categories
  (Cartoon, Magic, Machines, Music), in `core/sound/library.ts`; recorded files from
  SOUND_EFFECTS.md come later as entries with a file. A sound is added from the Sounds tab with its
  name button (at the first selected picture, or the playhead), not dragged; the tab also has its
  volume and Delete, and the row moves it (drag, or the arrow keys). The timeline toolbar's Duplicate
  and Delete don't act on sounds. A sound's start is in ticks like an overlay's, so a speed change
  keeps it on the same picture (its length stays in seconds). Playback schedules the sounds on the
  audio clock when Play is pressed and again when a loop comes round; sounds starting after the
  last picture aren't played or exported. Backups carry the sounds.
- **Later:** a sound's bar resizes like an overlay's (its ends, or Shift+arrows): a `length` of its
  own in ticks; shorter, it stops there with a short fade; longer, the sound starts again. Objects
  dropped on the overlay track start 5 ticks long (were 2 s), and both rows' bars show grips at their ends.

### 30 · Accessibility and keyboard map
- **Builds:** focus styles, labels for all icon buttons, a keyboard shortcut sheet (`?`), live region
  announcing captures, durations and playback state, colour-contrast check of tokens in light and dark,
  phone toolbar layout. In Playwright: `@axe-core/playwright` scans of the projects page and the studio,
  a keyboard-only end-to-end test, and screenshot tests (`toHaveScreenshot`) of both screens at phone,
  tablet and desktop widths in light and dark.
- **Decisions:** every action reachable by keyboard, including resize (`[` / `]`) and moving overlays;
  touch targets ≥ 56 px. Screenshot baselines are made in one browser and OS and stored in the repo;
  dynamic parts (the camera picture, dates) are masked.
- **Watch out:** global shortcuts must ignore keys typed in inputs and in element text editing.
  Screenshots differ between operating systems (font rendering), so baselines are per platform; update
  them deliberately with `--update-snapshots`, never to make a red test green without looking.
- **The step page explains:** what axe checks and what it can't (it finds maybe a third of real
  problems; the keyboard test and a screen reader pass cover more), how screenshot comparison works
  (pixel diff with a threshold, the diff image in the report), and how to review a changed baseline.
- **Check:** complete capture → resize → reorder → add a bubble → play → export using only the keyboard;
  axe reports no serious issues; a deliberate CSS change shows up as a screenshot diff.
- **As built (replaced on request):** only a **Help** button in the studio's top bar (now in the
  column beside the stage, D5) and the `?` key, opening a window with how to make an animation and every keyboard shortcut the studio
  has. No axe scans, keyboard-only run, screenshot tests or contrast pass: those can come back
  later as their own step.

### 31 · Performance with long projects
- **Builds:** timeline virtualisation once a project exceeds ~200 frames (by time range, since widths
  differ), lazy thumbnail loading, playback preloading tuned, a dev-only "generate 500 frames" button.
- **Decisions:** measure first (DevTools Performance + Memory with 500 frames), optimise only what shows
  up.
- **Watch out:** virtualisation and the reorder drag together need care (drag targets outside the rendered
  range); the overlay track must virtualise by the same time range.
- **Check:** 500 frames: timeline scrolls at 60 fps, memory stays under an agreed budget.
- **As built (re-evaluated after measuring):** measured first, with 500 and 2000 seeded pictures,
  in the dev server and a production build. Opening, scrolling and memory were already fine (2000
  pictures: ready in about a second, 60 fps scrolling, a 16 MB heap), so there's **no
  virtualisation and no lazy thumbnails**. What was slow was redrawing every picture on every
  change, and Play's first frames:
  - **The playhead draws on its own** (`timeline/Playhead.tsx`): while playing it changes many
    times a second, and the whole timeline used to follow it (23 frames over 50 ms in 3 s of play
    at 2000 pictures; now none after the first).
  - **The pictures are memoised** (`TimelineFrame`), with handlers that stay the same
    (`useStableCallback`) and children only when selected: a new selection redraws the pictures it
    changes, not all of them.
  - **The store keeps what didn't change:** `orderedFrames` hands back the same list while the
    frames and their order are the same, and a save coming back keeps the frame objects it didn't
    change (`sameFrame`), so moving one picture doesn't redraw every thumbnail.
  - **Play doesn't start the audio when there are no sounds:** starting it the first time held up
    the first frames for 150-430 ms; now about 70 ms (the first picture being drawn).
  - An arrow key at 2000 pictures (production build) now paints in about 60 ms, well inside the
    200 ms that feels instant; most of what's left is the browser laying out the page.
  - **No dev-only button:** `e2e/performance.spec.ts` seeds the pictures (`seedPictures(n, { onePhoto:
    true })`), checks a 1000-picture animation stays quick, and with `MEASURE=1` measures 2000 and
    prints the numbers.

### 32 · Offline (PWA)
- **Builds:** web app manifest, icons, a service worker caching the static export, an "install" hint,
  update prompt when a new version is available.
- **Decisions:** cache-first for the app shell; projects already live in IndexedDB, so the app is fully
  usable offline.
- **Watch out:** a stale service worker can serve an old app forever; version the cache and test the
  update path. Service workers need HTTPS (localhost excepted).
- **Check:** install, go offline, reload, capture and export still work.
- **Already in place:** the app is deployed as a static export over HTTPS at the root of
  https://stop-motion.studiosibiu.com/ (no `basePath`), so the service worker's scope is `/`. A step
  33 "Ship" was planned and dropped: the deploy happened outside the steps.
- **As built:** no PWA library (they hook into webpack; this build is Turbopack). `npm run build`
  runs `scripts/build-offline.mjs` after `next build`: it lists `out/` with `core/offline/precache.ts`
  (tested) and writes `out/sw.js` from `scripts/sw.js`, with a version per list (a hash of the
  files). The **shell** (pages, code, fonts, cardboard: 1.8 MB) is stored on the first visit, all
  or nothing; the **sounds** (24.9 MB) follow in the background and as they're played. Build notes
  (`/steps/`) stay online only. **Online first:** pages and every file without a hash in its name
  come from the network, the cache only without one (or after 4 s), so online the studio is always
  the latest; code chunks (hashed) come from the cache. A new worker takes over at once. Only a page
  opened from the stored copy shows an **Update** notice when a newer version arrives; it reloads
  when pressed, never by itself. Settings says when the studio works offline, with
  an **Install for offline use** button where the browser offers one. The worker runs only in the
  production build; `npm start` moved to port 3100 so its worker never answers for `npm run dev`.
  `e2e/offline.spec.ts` (production build only) goes offline after one visit, opens the studio,
  takes pictures and saves a GIF; online, a changed page shows at once and no notice appears; a page
  opened offline offers Update. Every other spec blocks service workers.

---

## Later (not planned)

More picture layers, more overlay tracks, overlays that stick to a picture, recording sounds (sound effects are 29b), drawing on the
time track (free drawing on pictures is step 24b),
animating elements between keyframes, backgrounds/chroma key, cloud backup and sync (e.g. Supabase
behind `ProjectRepository`), classroom sharing. Each would start with a `schemaVersion` bump and a
feature folder of its own.

## Progress

- [x] 00 Setup ([page](public/steps/00-setup.html))
- [x] 01 Studio shell and design tokens ([page](public/steps/01-studio-shell.html))
- [x] 02 Core model ([page](public/steps/02-core-model.html))
- [x] 03 Camera ([page](public/steps/03-camera.html))
- [x] 04 Editor store ([page](public/steps/04-editor-store.html))
- [x] 05 Capture to an in-memory timeline ([page](public/steps/05-capture.html))
- [x] 06 Dexie schema and repository ([page](public/steps/06-storage.html))
- [x] 07 Save captures and survive a refresh ([page](public/steps/07-persistence.html))
- [x] 08 End-to-end tests with Playwright ([page](public/steps/08-playwright.html))
- [x] 09 Projects page ([page](public/steps/09-projects.html))
- [x] 10 Time-scaled timeline and seconds ruler ([page](public/steps/10-timeline.html))
- [x] 11 Commands and undo/redo ([page](public/steps/11-undo.html))
- [x] 12 Frame operations ([page](public/steps/12-frame-operations.html))
- [x] 13 Resize a picture's duration ([page](public/steps/13-resize.html))
- [x] 14 Drag to reorder ([page](public/steps/14-reorder.html))
- [x] 15 Renderer ([page](public/steps/15-renderer.html))
- [x] 16 Playback ([page](public/steps/16-playback.html))
- [x] 17 Onion skin ([page](public/steps/17-onion-skin.html))
- [x] 18 Move, scale, rotate, flip ([page](public/steps/18-transform.html))
- [x] 19 Line up with other pictures
- [x] 20 Brightness and contrast
- [x] 21 Storage safety
- [x] 22 Plugin registry (became feature folders)
- [x] 23 Speech bubbles on pictures
- [x] 24 Overlay layer: text and shapes in time
- [x] 24b Free drawing on pictures
- [x] D1 Design system: the gallery page
- [x] D2 Design system: one list of tokens
- [x] D3 Design system: the floating tweak panel
- [x] D4 Design system: keeping tweaks, Copy changes
- [x] D5 The cardboard look, added after step 30 ([page](public/steps/d5-cardboard.html))
- [x] 25 GIF export ([page](public/steps/25-gif-export.html))
- [x] 26 Video export ([page](public/steps/26-video-export.html))
- [x] 27 Project archive ([page](public/steps/27-project-archive.html))
- [x] 28 Import photos ([page](public/steps/28-import-photos.html))
- [x] 29 Kid-friendly capture, cut down to the capture sound ([page](public/steps/29-capture-sound.html))
- [x] 29b Sound track: sound effects in time ([page](public/steps/29b-sound-track.html))
- [x] 30 Accessibility and keyboard map, replaced by a Help window ([page](public/steps/30-help.html))
- [x] 31 Performance with long projects, measured first: no virtualising needed ([page](public/steps/31-performance.html))
- [x] 32 Offline (PWA) ([page](public/steps/32-offline.html))
