# Stop-motion Studio: roadmap

The studio is built in **34 small steps (00-33)**. Each step is one reviewable change and one commit,
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
lists it in its review checklist, so `npm run test:e2e` keeps proving the whole app works. Vitest's
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
  directly here; it becomes a plugin in step 22.
- **Watch out:** the overlay must use the same cover-crop as the live `<video>` (step 03), or the ghost
  and the camera picture won't line up.
- **Check:** move a toy and line it up with its ghost.

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
- **Builds:** while a picture is selected, a **ghost** of the previous (or next, or a chosen) picture over
  it, at adjustable opacity, plus a **difference view** that turns everything that lines up black and
  makes misalignment glow; a view zoom slider with "fit" and "100%" and panning (space-drag or two
  fingers); snap guides to the centre and edges, and to the ghost's position; "copy position from
  previous" and "apply this position to the next N pictures" buttons.
- **Decisions:** the ghost and difference view reuse the onion-skin rendering from step 17 (the same
  `renderAt`, with `globalAlpha` or `globalCompositeOperation = "difference"`), so what lines up on screen
  lines up in export. Snapping is on by default with a small threshold and off while Alt is held.
  "Apply to next N" is one command.
- **Watch out:** the ghost must be drawn with *its own* transform, not the selected picture's. Snap
  guides must not fight arrow-key nudges (snap only during drags). The difference view is a looking
  aid; never export it.
- **Check:** shift a picture by hand, turn on the difference view, nudge until the background goes
  black; copy that position to the next 5 pictures with one click and undo it with one undo.

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

### 22 · Plugin registry *(core)*
- **Builds:** `core/plugins/registry` with typed `registerExporter`, `registerStageTool`,
  `registerPanel`, `registerFrameSource`, `registerElementKind`. `features/index.ts` imports the
  built-ins. The toolbar, stage tool bar and side panels render from the registry. Onion skin,
  properties and adjustments move into `features/`.
- **Decisions:** static registration only (imports at build time), no loading of remote code: this is
  a kids' app. Plugins change projects only via commands and read only via the repository/store.
  `ElementKind` is defined here but has no users until step 23.
- **Watch out:** this step is a refactor; the app must look and behave the same. Keep the diff to
  moving code plus the registry, nothing else.
- **Check:** everything works as before; deleting one import in `features/index.ts` removes that
  feature cleanly.

---

## Part 8 - Elements: speech bubbles, text and shapes

### 23 · Speech bubbles on pictures
- **Builds:** the `Element` type and `Frame.elements` *(core)*; an element editing layer on the stage
  (select, move, resize with corner handles, rotate, delete, type text in place); the
  `speech-bubble` kind as the first `ElementKind` plugin (rounded bubble, draggable tail point, a
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

---

## Part 9 - Export and import

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

### 31 · Performance with long projects
- **Builds:** timeline virtualisation once a project exceeds ~200 frames (by time range, since widths
  differ), lazy thumbnail loading, playback preloading tuned, a dev-only "generate 500 frames" button.
- **Decisions:** measure first (DevTools Performance + Memory with 500 frames), optimise only what shows
  up.
- **Watch out:** virtualisation and dnd-kit together need care (drag targets outside the rendered
  range); the overlay track must virtualise by the same time range.
- **Check:** 500 frames: timeline scrolls at 60 fps, memory stays under an agreed budget.

### 32 · Offline (PWA)
- **Builds:** web app manifest, icons, a service worker caching the static export, an "install" hint,
  update prompt when a new version is available.
- **Decisions:** cache-first for the app shell; projects already live in IndexedDB, so the app is fully
  usable offline.
- **Watch out:** a stale service worker can serve an old app forever; version the cache and test the
  update path. Service workers need HTTPS (localhost excepted).
- **Check:** install, go offline, reload, capture and export still work.

### 33 · Ship
- **Builds:** production build, deploy of `out/` to a static host with HTTPS (GitHub Pages with
  `basePath`, or Netlify/Vercel), README with a "try it" link and a short privacy note ("photos never
  leave your device").
- **Decisions:** static hosting only; no backend to run or secure.
- **Watch out:** camera requires HTTPS; GitHub Pages under `/stop-motion-studio/` needs `basePath` and
  `assetPrefix`, and the service worker scope must match.
- **Check:** open the deployed URL on a tablet, make and export an animation.

---

## Later (not planned)

More picture layers, more overlay tracks, overlays that stick to a picture, sound, free drawing,
animating elements between keyframes, backgrounds/chroma key, cloud backup and sync (e.g. Supabase
behind `ProjectRepository`), classroom sharing. Each would start with a `schemaVersion` bump and a
registry entry.

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
- [ ] 12 Frame operations
- [ ] 13 Resize a picture's duration
- [ ] 14 Drag to reorder
- [ ] 15 Renderer
- [ ] 16 Playback
- [ ] 17 Onion skin
- [ ] 18 Move, scale, rotate, flip
- [ ] 19 Line up with other pictures
- [ ] 20 Brightness and contrast
- [ ] 21 Storage safety
- [ ] 22 Plugin registry
- [ ] 23 Speech bubbles on pictures
- [ ] 24 Overlay layer: text and shapes in time
- [ ] 25 GIF export
- [ ] 26 Video export
- [ ] 27 Project archive
- [ ] 28 Import photos
- [ ] 29 Kid-friendly capture
- [ ] 30 Accessibility and keyboard map
- [ ] 31 Performance with long projects
- [ ] 32 Offline (PWA)
- [ ] 33 Ship
