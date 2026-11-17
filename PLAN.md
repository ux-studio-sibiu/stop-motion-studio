# Stop-motion Studio: plan

A web stop-motion studio for kids: take photos with the webcam, see them on a timeline, play them back,
nudge frames into place and export a GIF or video. It runs entirely in the browser: no accounts, and no
photos leave the device.

Built one small, reviewable step at a time (see [ROADMAP.md](ROADMAP.md)), like `carbon-divide`,
`how-we-die` and `web-components-pwa`.

Starting point: a ChatGPT planning conversation (Next.js + Zustand + Dexie + dnd-kit + gifenc). This
plan keeps its shape and changes what is listed under "What changed from the original plan".

---

## 1. Decisions

| Topic | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript**, used as a client-only app with static export (`output: "export"`) | Matches the workspace's other prototypes, `COMPONENT_PATTERNS.md` and the skills. The app needs no server: camera, canvas, storage and encoding all run in the browser |
| Routing | `/` (projects) and `/studio?project=<id>`, **no `[projectId]` segment** | Static export can't pre-render dynamic segments for IDs that only exist in the user's browser. A query param works with any static host |
| Styling | **SCSS** modules/partials with tokens on `:root`, per `STYLE_GUIDE.md` (no Tailwind, no shadcn/ui) | Workspace convention: `nsc-` on component roots only, no BEM `__`/`--`, hyphenated names |
| Icons | `lucide-react` | Small, tree-shaken, consistent stroke style |
| Live editor state | **Zustand** | Selection, tool, playback, drag-in-progress values, undo history. Small and framework-light |
| Persistent data | **Dexie (IndexedDB)** behind a `ProjectRepository` interface | Stores Blobs natively, works offline, has transactions and live queries. The interface keeps cloud sync possible later |
| Frame order | A `frameIds: string[]` list on the project record, not an `order` number on each frame | Reorder/insert/delete changes one record instead of renumbering N frames, and undo is a single swap |
| Timeline | **Time-scaled**: each picture's width is its duration. Drag its right edge to make it longer or shorter (snaps to whole ticks), drag the body to reorder. A faint seconds ruler sits above the strip | Duration is something kids can see and grab, instead of a number in a panel |
| Time unit | **Ticks** (`1/fps`) for everything on the timeline: picture `hold`, overlay `start` / `length` | One unit keeps the two layers lined up when the speed changes; the ruler converts ticks to seconds for display |
| Things on top of pictures | **Elements** (speech bubbles, text, shapes, stickers): one shape of data, two homes. On a frame they belong to that picture and move with it; on the overlay layer they live in time, spanning any number of pictures | The same drawing and editing code serves both |
| Moving pictures | **Fast by hand, precise by keyboard**: drag, wheel/pinch and a rotate handle on the stage; arrow nudges of 1 project px (Shift: 10) and number fields. For lining up: see-through (the picture before) with a "spot the difference" look, snap guides while dragging, and a view zoom (Ctrl + wheel or pinch, Space-drag to pan) | Bumped cameras and sets are the normal case in stop-motion; realigning has to be quick |
| Two zooms | **View zoom** (look closer, UI state, not saved) is separate from **picture scale** (part of the frame, exported) | Zooming in to check alignment must never change the animation |
| Duplicates | **A duplicate is visually identical to its source**: same image, copies of `hold`, `transform`, `adjust` and `elements`; only ids are new. One `cloneFrame()` in `core/` does it, with a test that fails when a new `Frame` field isn't copied | Duplicating is how kids make pauses and variations; a copy that jumps or loses its bubble breaks trust |
| Undo/redo | **Command pattern from day one**: every change to a project is a command with `do()` / `undo()` | Retrofitting undo is painful. Commands are also the one safe way features change a project |
| Extension | **Feature folders, composed directly**: each feature's code lives in `src/features/<name>/`, and `Studio.tsx` imports its components and places them in its JSX. Plain lists only where there are many items of one kind handled alike: element kinds (a map of drawing functions, step 23), exporters (step 25). *Changed in step 22: a plugin registry was built, then removed.* | Moving a piece of UI is moving its line, which matters while the UX is still being tried out. A registry decides placement for the features, so each experiment needed a new slot. Nothing is ever loaded from outside: this is a kids' app |
| Rendering | Canvas 2D, one `renderAt(time)` shared by preview, onion skin and export: the picture, its elements, then the overlays active at that time | What you see is what you export |
| Drag & drop | Plain pointer events for both reordering (`useReorder`) and resizing (`useResize`); no drag library. *Changed in step 14: the plan was `@dnd-kit/sortable`.* | dnd-kit's keyboard dragging needs each picture to take focus, but the timeline keeps focus on the list (`aria-activedescendant`), so Ctrl+arrows move pictures instead. Our own drag also fits the resize grip, group moves and the time-scaled widths without fighting a library, and adds no dependency. Touch: hold to pick up |
| Remembered UI state | One registry, `src/studio/remembered.ts`: typed `definePreference(name, parse)` entries in `localStorage` (camera, camera off, open tab, loop, see-through, zoom, and per animation its view and selection), used through `useRememberedState` / `useRememberedStore`. *Added after step 18.* | A child finds the studio as they left it. One place to see and add what's remembered; every stored value is checked by its parser, because anything can be in storage. Remembered by default (repo `CLAUDE.md`); moment-to-moment state isn't |
| Stage tools per tab | The side panel's open tab lives in the editor store (`panelTab`); a tab's tools on the stage (moving a picture for Picture) only show while it's open. *Added after step 18.* | Each tab owns its tools, so later tabs (speech bubbles, step 23) add theirs the same way without clashing |
| Safe zone | Each animation's `safeMargin` (0-60 project px, default 20): the edge band the video leaves out, shown veiled with a dotted line; export crops to `exportRect` | Wobbly edges of the set stay out of the film; saved with the animation because the file depends on it |
| Outlines | One `--line-width` (2px) for every outline: buttons, fields, stage, panels, tabs, dropdowns; hairlines (dividers, ruler) stay 1px | One value to change the whole look; the joints (tab ears, the timeline tab's corner) are worked out from it |
| GIF export | `gifenc`, in a Web Worker | Small and fast. The worker keeps the UI responsive |
| Video export | `mediabunny` (WebCodecs + muxing), only when the browser supports it | Real MP4/WebM without shipping FFmpeg.wasm (~30 MB) |
| Backup | Project archive (`.zip` of `project.json` + images) via `fflate` | Browser storage is not a backup; kids' work must be exportable |
| Tests | Three layers. **Vitest** (Node) for `core/` and adapters, `fake-indexeddb` for Dexie: fast, many edge cases. **Playwright** end-to-end tests from step 08: the real app in Chromium and WebKit, a fake webcam playing a generated video, real IndexedDB; later axe accessibility scans and screenshot tests. **Vitest browser mode** from step 15 for canvas pixel tests | Logic is tested where failures are cheap to find; a few end-to-end flows prove the pieces work together in a real browser. No jsdom component tests: jsdom has no camera, canvas or IndexedDB |
| Offline | Installable PWA with a service worker, late in the roadmap | Classrooms often have bad Wi-Fi |

### What changed from the original plan

- **SCSS instead of Tailwind + shadcn/ui**, to follow the workspace style guide.
- **Query-param routing** instead of `studio/[projectId]`, because of static export.
- **`frameIds` on the project** instead of `order` per frame.
- **Commands + undo from the first editing step**, not "later".
- **Feature folders**, composed directly in the studio (step 22).
- **Thumbnails stored separately at capture time**, so the timeline never loads full images.
- **Non-destructive adjustments** (brightness/contrast stored as numbers, applied when rendering).
- **End-to-end tests with Playwright** (fake camera, real storage), not only unit tests.
- **Alignment tools** (ghost, difference view, snapping, view zoom) and **identical duplicates**.
- **A time-scaled, two-layer timeline**: resizable pictures, a seconds ruler, and an overlay layer for
  text and shapes. Speech bubbles attach to single pictures.
- Dropped: Sharp (server-only, not needed), FFmpeg.wasm (too heavy), gif.js (replaced by gifenc).

---

## 2. Architecture

Four layers. Arrows are the only allowed import directions.

```
  ui (studio/, app/)          React components, SCSS, hooks
        │
        ▼
  store (store/)              Zustand: live editor state, history stack
        │
        ▼
  core (core/)                Plain TypeScript. Model, commands, playback clock,
        ▲                     renderer. No React, Next, Dexie or DOM globals
        │                     beyond what is passed in
  adapters (adapters/)        Implement core interfaces: Dexie repository, camera,
                              GIF/video encoders, archive import/export
```

- **`core/` imports nothing from the other layers.** An ESLint `no-restricted-imports` rule enforces it.
- Adapters implement interfaces defined in `core/` (`ProjectRepository`, `Exporter`, `FrameSource`).
- The UI talks to the project only through commands; it reads data through live queries and the store.

### Folder structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 projects list
│   └── studio/page.tsx          the studio (reads ?project=)
├── core/
│   ├── model/                   types, defaults, id helpers, schema version, timing (ticks ↔ ms)
│   ├── commands/                Command type, history, frame / element / overlay commands
│   ├── playback/                clock (rAF + elapsed time), what is on screen at time t
│   ├── render/                  renderAt(), letterboxing, adjustments, element drawing
├── adapters/
│   ├── storage/                 Dexie db, DexieProjectRepository, storage info
│   ├── camera/                  capture(), resize, thumbnail
│   ├── export/                  gif (worker), video, archive
│   └── import/                  photo import, archive import
├── store/                       editorStore + slices
├── studio/                      Studio components (Toolbar, Stage, Timeline, ...) + .scss
├── features/                    one folder per feature (camera, picture, onion-skin, ...), placed by Studio.tsx
└── styles/                      tokens, globals, breakpoints
```

---

## 3. Data model

```ts
type Project = {
  id: string;
  schemaVersion: number;
  name: string;
  width: number;            // working resolution, default 1280
  height: number;           // default 720
  fps: number;              // default 8
  frameIds: string[];       // the order of the animation
  createdAt: number;
  updatedAt: number;
};

type Frame = {
  id: string;
  projectId: string;
  imageId: string;          // several frames may share one image (duplicate / hold)
  hold: number;             // how many ticks this frame stays on screen, default 1
  transform: { x: number; y: number; scale: number; rotation: number; flipX: boolean; flipY: boolean };
  adjust: { brightness: number; contrast: number };   // 1 = unchanged
};

type StoredImage = { id: string; projectId: string; blob: Blob; width: number; height: number; createdAt: number };
type StoredThumb = { imageId: string; projectId: string; blob: Blob };   // ~160 px wide

// Added in steps 23-24 (types sketched here so earlier steps leave room for them):

// Something drawn on top of a picture (an "object" in the app). `kind` says how it's drawn: a plain
// map from kind to drawing function (core/render/elements.ts).
type Element = {
  id: string;
  kind: string;             // "speech-bubble", "text", "shape" (rectangle, ellipse or arrow), ...
  box: { x: number; y: number; width: number; height: number; rotation: number };   // fractions of the frame
  props: Record<string, unknown>;   // kind-specific: text, colours, the bubble's tail point
};

// Frame gains: elements: Element[]   (on this picture only; reorder / duplicate carry them along)

// The second timeline layer: an element that lives in time, not on a picture. Kept as a list on
// the project (Project.overlays, step 24): short, saved and watched with the project.
type Overlay = {
  id: string;
  track: number;            // 1 for now; more layers later
  start: number;            // ticks from the start of the animation
  length: number;           // ticks, >= 1
  element: Element;
};
```

- Frame timing is `hold` in ticks of `1/fps`, not milliseconds: changing FPS keeps the rhythm kids built.
  Resizing a picture on the timeline changes its `hold`, snapped to whole ticks.
- Overlays use the same ticks, so they stay lined up with the pictures when the speed changes. They are
  anchored to **time**, not to pictures: inserting a picture earlier shifts the pictures but not the
  overlays (like a second track in a video editor). "Stick to this picture" can be added later.
- Images are kept until no frame references them (garbage collection, step 21). Undoing a delete
  therefore always finds its image.
- Picture layers, sound and keyframes are later additions: a `schemaVersion` bump plus a Dexie migration.
  Until the app ships, changes to the stored shape can simply reset the dev database.

---

## 4. Extension points

| Extension point | Shape | First users |
|---|---|---|
| Commands | `Command { label; do(ctx); undo(ctx) }` in `core/commands` | delete, duplicate, insert, reorder, resize, transform, adjust, element and overlay edits |
| Features | A folder in `src/features/`, its components placed by hand in `Studio.tsx` | camera, picture, see-through, objects |
| Element kinds | A map from kind to its drawing function (`core/render/elements.ts`), its defaults and settings reader in `core/model`, and its tile and settings component placed by hand in the Objects tab (step 23) | speech bubble, text, shape (rectangle, ellipse, arrow) |
| Exporters | An array of `{ id; label; isSupported(); run(…, onProgress) }` (step 25) | GIF, video, image sequence, project archive |
| Storage | `ProjectRepository` in `core/model` | Dexie now, Supabase later |

Features change a project only through the commands the studio passes them, so everything they do
can be undone. Lists of data (element kinds, exporters) are the "dynamic data" exception in
`COMPONENT_PATTERNS.md`; everything else composes content as JSX children.

---

## 5. Storage policy

- Capture at the project's working resolution (default 1280×720, max 1920×1080), JPEG at 0.9.
- Thumbnails generated at capture time; the timeline loads only thumbnails.
- Full images decoded on demand into an `ImageBitmap` cache with a size limit.
- Request persistent storage (`navigator.storage.persist()`) when the first project is created.
- Show a storage meter and warn at 80% of the estimated quota; catch `QuotaExceededError` with a
  friendly message.
- Project archive export from early on; browser storage is never the only copy that matters.

---

## 6. Designing for kids

- One big capture button, one big play button, one big undo button.
- Plain words: "pictures", "speed", "see-through" instead of "frames", "FPS", "onion skin" (tooltips may
  keep the real term).
- Large touch targets (min 56 px), works on a tablet in landscape.
- Autosave everything; no save button, no file dialogs except export.
- Celebrate each capture; count pictures ("You've made 12 pictures!").
- Destructive actions are undoable; deleting a whole project asks first.
- No accounts, no uploads, no tracking.

---

## 7. Out of scope (for now)

Several picture layers, audio tracks, free drawing on frames, animating elements between keyframes,
chroma key, cloud sync and sharing, multi-user editing. The architecture leaves room for each; none is
planned in the roadmap.
