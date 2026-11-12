# Stop-motion Studio: roadmap

The studio is built in **29 small steps (00-28)**. Each step is one reviewable change and one commit,
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
- **Builds:** `adapters/camera/useCamera`: starts/stops `getUserMedia`, lists devices, switches camera,
  exposes `status` (`idle | asking | live | denied | no-camera | error`). `CameraPanel` shows the live
  `<video>` in the stage with friendly messages per status.
- **Decisions:** the preview is mirrored only when it's a front-facing camera, and only in CSS; captured
  images are never mirrored (kids animating toys expect the real-world direction). Audio is off.
- **Watch out:** stop every track on unmount, or the camera light stays on. React Strict Mode mounts
  twice in dev: guard against two streams. iOS needs `playsInline` + `muted`. Device labels are empty
  until permission is granted.
- **Check:** allow/deny permission, unplug the webcam, switch cameras; the light turns off on leaving.

### 04 · Editor store
- **Builds:** `store/editorStore` with slices: `project` (current project + frames in memory),
  `selection`, `playback` (`isPlaying`, `currentIndex`), `ui` (panel open states).
- **Decisions:** the store holds **metadata only, never Blobs**. Blobs go to an `ImageCache` (a
  `Map<imageId, Blob>` for now, Dexie in step 07). Selectors per component to avoid re-renders.
- **Watch out:** don't put the `MediaStream` or DOM nodes in the store; keep them in refs.
- **Check:** store unit tests; React DevTools shows no full-tree re-render on selection change.

### 05 · Capture to an in-memory timeline
- **Builds:** `adapters/camera/capture`: draw the video to a canvas at the project's working resolution
  (cover-fit), `toBlob` JPEG 0.9, plus a 160 px thumbnail. Big capture button + Space key. A plain
  timeline strip of thumbnails (no persistence yet).
- **Decisions:** resize at capture, not at export, so storage stays small. Thumbnail generated now so
  the timeline never decodes full images.
- **Watch out:** `videoWidth` is 0 until `loadedmetadata`; disable capture until then. Space must not
  capture while focus is in an input or on a button (it would also "click" it). Revoke every object URL.
- **Check:** capture 10 pictures; thumbnails appear instantly; memory stays flat in DevTools.

---

## Part 3 - Persistence

### 06 · Dexie schema and repository *(core + adapter)*
- **Builds:** `core/model/ProjectRepository` interface. `adapters/storage/db.ts` with version 1 tables:
  `projects: "id, updatedAt"`, `frames: "id, projectId"`, `images: "id, projectId"`,
  `thumbs: "imageId, projectId"`. `DexieProjectRepository` implementing it. Tests with
  `fake-indexeddb`.
- **Decisions:** thumbs are a separate table so listing them never touches full images. Only fields
  that are queried are indexed. The rest of the app depends on the interface, never on `db` directly.
- **Watch out:** IndexedDB doesn't exist during the static build: create `db` lazily (on first use in
  the browser), never at module top level in code a Server Component imports.
- **Check:** repository tests pass: create, read, add frame, delete project with cascade.

### 07 · Save captures and survive a refresh
- **Builds:** `captureAndSave()` writes image + thumb + frame and appends to `project.frameIds` in **one
  transaction**. The timeline reads via `useLiveQuery`. The studio creates a default project when
  `?project=` is missing and puts its id in the URL.
- **Decisions:** Dexie is the source of truth for the project; Zustand mirrors it plus holds transient
  state. A load step repairs drift: ids in `frameIds` with no frame are dropped, frames missing from it
  are appended.
- **Watch out:** `useLiveQuery` returns `undefined` while loading, not `[]`; render a loading state.
  Replace the URL (`router.replace`), don't push, or Back leads to an empty studio.
- **Check:** capture, refresh, the pictures are still there; open the same project in two tabs and
  capture in one, the other updates.

### 08 · Projects page
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

### 09 · Thumbnails, selection and keyboard
- **Builds:** `Timeline` + `FrameThumb` components, `useBlobUrl(blob)` hook that creates and revokes
  object URLs, click to select, arrow keys to move the selection, picture numbers, auto-scroll to the
  selected frame, a "camera" slot at the end showing where the next capture lands.
- **Decisions:** the timeline is a `role="listbox"` for keyboard and screen readers. Content is JSX
  children (`<Timeline>{frames.map(...)}</Timeline>`), per `COMPONENT_PATTERNS.md`.
- **Watch out:** a revoked URL still used by an `<img>` shows a broken image: revoke on unmount or when
  the blob changes, not before.
- **Check:** 100 frames scroll smoothly; selection follows arrow keys.

### 10 · Commands and undo/redo *(core)*
- **Builds:** `core/commands`: `Command` type, `History` (undo/redo stacks, limit 100), `runCommand()`
  that executes against the repository and pushes to history. First command: `DeleteFrames`. Undo/redo
  buttons, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z.
- **Decisions:** commands store just enough to reverse themselves (e.g. the deleted frames and their
  positions). Deleting a frame never deletes its image (see step 18), so undo is always possible. History
  is per open project and in memory only.
- **Watch out:** a command must be atomic: one Dexie transaction per `do()`/`undo()`. A new command
  clears the redo stack.
- **Check:** delete 3 frames, undo, they return in place; tests cover do → undo → redo round-trips.

### 11 · Frame operations
- **Builds:** `DuplicateFrames` (new frame, same `imageId`), `InsertCaptureAt` (the next capture goes
  after the selected frame), `SetHold` (longer/shorter), multi-select with Shift/Ctrl, toolbar buttons.
- **Decisions:** duplicating shares the image instead of copying the blob: cheap, and it's how kids
  make "pauses". Hold is shown as a wider thumbnail, not a number.
- **Watch out:** inserting must update the selection to the new frame, or the next capture lands in the
  wrong place.
- **Check:** duplicate, insert in the middle, undo each; storage meter doesn't grow on duplicate.

### 12 · Drag to reorder
- **Builds:** `@dnd-kit/sortable` on the timeline with pointer, touch and keyboard sensors;
  `ReorderFrames` command on drop.
- **Decisions:** an activation distance (~8 px) so a tap still selects. Only the final drop creates a
  command; dragging itself doesn't touch Dexie.
- **Watch out:** horizontal auto-scroll while dragging near edges; dragging a multi-selection moves the
  whole group.
- **Check:** reorder with mouse, finger (DevTools touch) and keyboard; undo restores the order.

---

## Part 5 - Playback

### 13 · Renderer *(core)*
- **Builds:** `core/render/drawFrame(ctx, image, frame, project)`: letterbox into the canvas, apply
  transform (translate, rotate, scale, flip) and adjust. `adapters/render/BitmapCache`: decodes Blobs to
  `ImageBitmap` on demand with an LRU limit (e.g. 30 bitmaps) and `close()` on eviction. The stage shows
  the selected frame through it.
- **Decisions:** one renderer for stage, playback, onion skin and export, so preview matches the file.
  The canvas has the project's resolution; CSS scales it to fit.
- **Watch out:** `ImageBitmap`s use memory outside the JS heap; forgetting `close()` leaks fast. Set the
  canvas backing size for `devicePixelRatio` only on the stage, not for export.
- **Check:** select frames quickly; memory stays bounded in DevTools > Memory.

### 14 · Playback
- **Builds:** `core/playback/Clock` using `requestAnimationFrame` and elapsed time (no `setInterval`),
  honouring `hold`. Play/pause (big button, Enter), speed control (5, 8, 10, 12, 15 fps shown as
  "slow ... fast"), loop toggle, preloading the next few bitmaps.
- **Decisions:** the clock is pure TS and takes `now()` as input, so it's unit-tested with fake time.
  Playback reads frames from the store snapshot taken at play time.
- **Watch out:** rAF pauses in background tabs; recompute from elapsed time when it resumes instead of
  fast-forwarding. Stop playback when the camera captures.
- **Check:** 24 frames at 12 fps take 2 s (stopwatch or test); dropped frames don't change duration.

### 15 · Onion skin ("see-through")
- **Builds:** in camera mode, the previous 1-3 frames drawn over the live video at adjustable opacity
  (default 40%), with a toggle. Stage modes become explicit: `camera`, `frame`, `playing`.
- **Decisions:** the overlay is a canvas above the `<video>`, drawn with the same renderer. Implemented
  directly here; it becomes a plugin in step 19.
- **Watch out:** if the live preview is mirrored, the overlay must be mirrored the same way or it looks
  wrong.
- **Check:** move a toy and line it up with its ghost.

---

## Part 6 - Editing

### 16 · Move, scale, rotate, flip
- **Builds:** `PropertiesPanel` with sliders/steppers and flip buttons; drag on the stage to move, pinch
  or wheel to scale; "reset" button. `TransformFrames` command.
- **Decisions:** during a drag the transform lives in Zustand and the stage redraws from it; one
  command is written on `pointerup`. Transforms are relative to project size, so they survive a
  resolution change.
- **Watch out:** use pointer events with `setPointerCapture`, not mouse + touch events. Rotation around
  the frame centre, not the canvas origin.
- **Check:** drag a frame, undo returns it in one step (not 60).

### 17 · Brightness and contrast
- **Builds:** two sliders in the panel, `AdjustFrames` command, "apply to all" button. The renderer
  applies them with `ctx.filter`, with a pixel-loop fallback.
- **Decisions:** non-destructive: the original photo is never changed. "Apply to all" is one command, so
  one undo.
- **Watch out:** check `ctx.filter` support in the target Safari version and keep the fallback tested.
  The pixel fallback is slow at 1080p; run it only for the stage and export, not during slider drags.
- **Check:** adjust, undo, export later shows the same result as the stage.

### 18 · Storage safety
- **Builds:** image garbage collection (delete images/thumbs no frame references) on project open and
  after history is cleared; `QuotaExceededError` handling with a kid-friendly message; storage warning
  at 80%; "storage" section in the projects page.
- **Decisions:** GC never runs while undo history could still need an image.
- **Watch out:** test GC against duplicated frames (shared images) so a shared image is never deleted.
- **Check:** delete frames, close and reopen the project, storage drops; fill quota in a test profile
  and see the message instead of a crash.

---

## Part 7 - Extension points

### 19 · Plugin registry *(core)*
- **Builds:** `core/plugins/registry` with typed `registerExporter`, `registerStageTool`,
  `registerPanel`, `registerFrameSource`. `features/index.ts` imports the built-ins. The toolbar, stage
  tool bar and side panels render from the registry. Onion skin, properties and adjustments move into
  `features/`.
- **Decisions:** static registration only (imports at build time), no loading of remote code: this is
  a kids' app. Plugins change projects only via commands and read only via the repository/store.
- **Watch out:** this step is a refactor; the app must look and behave the same. Keep the diff to
  moving code plus the registry, nothing else.
- **Check:** everything works as before; deleting one import in `features/index.ts` removes that
  feature cleanly.

---

## Part 8 - Export and import

### 20 · GIF export
- **Builds:** `features/gif-export`: renders each frame with the shared renderer onto an
  `OffscreenCanvas` in a Web Worker, encodes with `gifenc`, honours `hold`, shows progress, downloads
  the file. Size options (small/medium).
- **Decisions:** GIF is the first export because it plays everywhere and kids can share it. Default
  width 640 px to keep files small.
- **Watch out:** transfer `ImageBitmap`s to the worker (transferable), don't copy pixel arrays. GIF has
  256 colours per frame: quantise per frame for photos. Long projects make big GIFs; warn above ~20 MB.
- **Check:** export 30 frames, open the GIF in another app, timing matches playback.

### 21 · Video export
- **Builds:** `features/video-export` with Mediabunny: MP4 (H.264) or WebM (VP9) depending on
  `VideoEncoder.isConfigSupported`, progress, download. The button is hidden when unsupported.
- **Decisions:** frames held for several ticks are encoded as one frame with a longer duration, not
  repeated. No FFmpeg.wasm.
- **Watch out:** WebCodecs support differs across browsers and versions; detect, don't sniff the user
  agent. Even dimensions are required by H.264.
- **Check:** exported video plays in the OS player at the right speed.

### 22 · Project archive (backup and restore)
- **Builds:** export a project as `.zip` (`project.json` with `schemaVersion` + `images/*.jpg`) with
  `fflate`; import validates, assigns new ids if the project already exists, and regenerates thumbnails.
- **Decisions:** the archive format is the stable public format; Dexie's schema can change behind it.
  Import is all-or-nothing in one transaction.
- **Watch out:** never trust imported JSON: validate types and sizes, cap the number of images.
- **Check:** export, delete the project, import, everything (order, holds, transforms) is back.

### 23 · Import photos
- **Builds:** `features/photo-import` as a `FrameSource`: file picker and drag-and-drop onto the
  timeline; images resized to the working resolution, thumbnails made, inserted after the selection in
  one command.
- **Decisions:** same pipeline as capture after the Blob exists, so the timeline doesn't care where a
  frame came from.
- **Watch out:** HEIC from iPhones may not decode in every browser; show a clear message. Respect EXIF
  orientation (`createImageBitmap` with `imageOrientation: "from-image"`).
- **Check:** import 10 photos of mixed sizes; one undo removes them all.

---

## Part 9 - Kids, polish and shipping

### 24 · Kid-friendly capture
- **Builds:** countdown timer (off, 3, 5, 10 s) with big numbers, capture flash and a small celebration,
  picture counter ("You've made 12 pictures!"), optional sounds with mute, plain-language labels with
  real terms in tooltips.
- **Decisions:** celebrations are short (<1 s) and never block the next capture. Sounds have their own
  toggle; animations respect `prefers-reduced-motion`.
- **Watch out:** autoplay rules: sounds only start after a user gesture.
- **Check:** a 7-year-old can make a 10-frame animation without help (the real test).

### 25 · Accessibility and keyboard map
- **Builds:** focus styles, labels for all icon buttons, a keyboard shortcut sheet (`?`), live region
  announcing captures and playback state, colour-contrast check of tokens in light and dark.
- **Decisions:** every action reachable by keyboard; touch targets ≥ 56 px.
- **Watch out:** global shortcuts must ignore keys typed in inputs.
- **Check:** complete capture → reorder → play → export using only the keyboard.

### 26 · Performance with long projects
- **Builds:** timeline virtualisation once a project exceeds ~200 frames, lazy thumbnail loading,
  playback preloading tuned, a dev-only "generate 500 frames" button.
- **Decisions:** measure first (DevTools Performance + Memory with 500 frames), optimise only what shows
  up.
- **Watch out:** virtualisation and dnd-kit together need care (drag targets outside the rendered
  range).
- **Check:** 500 frames: timeline scrolls at 60 fps, memory stays under an agreed budget.

### 27 · Offline (PWA)
- **Builds:** web app manifest, icons, a service worker caching the static export, an "install" hint,
  update prompt when a new version is available.
- **Decisions:** cache-first for the app shell; projects already live in IndexedDB, so the app is fully
  usable offline.
- **Watch out:** a stale service worker can serve an old app forever; version the cache and test the
  update path. Service workers need HTTPS (localhost excepted).
- **Check:** install, go offline, reload, capture and export still work.

### 28 · Ship
- **Builds:** production build, deploy of `out/` to a static host with HTTPS (GitHub Pages with
  `basePath`, or Netlify/Vercel), README with a "try it" link and a short privacy note ("photos never
  leave your device").
- **Decisions:** static hosting only; no backend to run or secure.
- **Watch out:** camera requires HTTPS; GitHub Pages under `/stop-motion-studio/` needs `basePath` and
  `assetPrefix`, and the service worker scope must match.
- **Check:** open the deployed URL on a tablet, make and export an animation.

---

## Later (not planned)

Layers, sound, titles, drawing tools, backgrounds/chroma key, cloud backup and sync (e.g. Supabase
behind `ProjectRepository`), classroom sharing. Each would start with a `schemaVersion` bump and a
registry entry.

## Progress

- [x] 00 Setup ([page](public/steps/00-setup.html))
- [x] 01 Studio shell and design tokens ([page](public/steps/01-studio-shell.html))
- [ ] 02 Core model
- [ ] 03 Camera
- [ ] 04 Editor store
- [ ] 05 Capture to an in-memory timeline
- [ ] 06 Dexie schema and repository
- [ ] 07 Save captures and survive a refresh
- [ ] 08 Projects page
- [ ] 09 Thumbnails, selection and keyboard
- [ ] 10 Commands and undo/redo
- [ ] 11 Frame operations
- [ ] 12 Drag to reorder
- [ ] 13 Renderer
- [ ] 14 Playback
- [ ] 15 Onion skin
- [ ] 16 Move, scale, rotate, flip
- [ ] 17 Brightness and contrast
- [ ] 18 Storage safety
- [ ] 19 Plugin registry
- [ ] 20 GIF export
- [ ] 21 Video export
- [ ] 22 Project archive
- [ ] 23 Import photos
- [ ] 24 Kid-friendly capture
- [ ] 25 Accessibility and keyboard map
- [ ] 26 Performance with long projects
- [ ] 27 Offline (PWA)
- [ ] 28 Ship
