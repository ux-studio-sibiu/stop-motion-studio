# Stop-motion Studio: plan

A web stop-motion studio for kids: take photos with the webcam, see them on a timeline, play them back,
nudge frames into place and export a GIF or video. It runs entirely in the browser: no accounts, and no
photos leave the device.

Built one small, reviewable step at a time (see [ROADMAP.md](ROADMAP.md)), like `data-viz`,
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
| Undo/redo | **Command pattern from day one**: every change to a project is a command with `do()` / `undo()` | Retrofitting undo is painful. Commands are also the one safe way plugins change a project |
| Extension | A small **registry** for exporters, stage tools and panels; built-in features register the same way | New features plug in instead of editing the studio shell. Registration is static (imported at build time), never remote code |
| Rendering | Canvas 2D, one renderer function shared by preview, onion skin and export | What you see is what you export |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Touch-friendly, accessible, works for a horizontal strip |
| GIF export | `gifenc`, in a Web Worker | Small and fast. The worker keeps the UI responsive |
| Video export | `mediabunny` (WebCodecs + muxing), only when the browser supports it | Real MP4/WebM without shipping FFmpeg.wasm (~30 MB) |
| Backup | Project archive (`.zip` of `project.json` + images) via `fflate` | Browser storage is not a backup; kids' work must be exportable |
| Tests | **Vitest** for `core/` and adapters (`fake-indexeddb` for Dexie); manual browser checks for camera/UI | The core is plain TypeScript, so it is cheap to test properly |
| Offline | Installable PWA with a service worker, late in the roadmap | Classrooms often have bad Wi-Fi |

### What changed from the original plan

- **SCSS instead of Tailwind + shadcn/ui**, to follow the workspace style guide.
- **Query-param routing** instead of `studio/[projectId]`, because of static export.
- **`frameIds` on the project** instead of `order` per frame.
- **Commands + undo from the first editing step**, not "later".
- **A plugin registry** as an explicit extension point.
- **Thumbnails stored separately at capture time**, so the timeline never loads full images.
- **Non-destructive adjustments** (brightness/contrast stored as numbers, applied when rendering).
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
        ▲                     renderer, registry. No React, Next, Dexie or DOM globals
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
│   ├── model/                   types, defaults, id helpers, schema version
│   ├── commands/                Command type, history, frame commands
│   ├── playback/                clock (rAF + elapsed time), frame timing
│   ├── render/                  drawFrame(), letterboxing, adjustments
│   └── plugins/                 registry + extension types
├── adapters/
│   ├── storage/                 Dexie db, DexieProjectRepository, storage info
│   ├── camera/                  capture(), resize, thumbnail
│   ├── export/                  gif (worker), video, archive
│   └── import/                  photo import, archive import
├── store/                       editorStore + slices
├── studio/                      Studio components (Toolbar, Stage, Timeline, ...) + .scss
├── features/                    built-in plugins (gif-export, onion-skin, ...) registering themselves
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
```

- Frame timing is `hold` in ticks of `1/fps`, not milliseconds: changing FPS keeps the rhythm kids built.
- Images are kept until no frame references them (garbage collection, step 18). Undoing a delete
  therefore always finds its image.
- Layers, sound and titles are later additions: a `schemaVersion` bump plus a Dexie migration.

---

## 4. Extension points

| Extension point | Interface (in `core/`) | First users |
|---|---|---|
| Commands | `Command { label; do(ctx); undo(ctx) }` | delete, duplicate, insert, reorder, transform, adjust |
| Exporters | `Exporter { id; label; icon; isSupported(); run(project, frames, onProgress) }` | GIF, video, image sequence, project archive |
| Stage tools | `StageTool { id; icon; onPointerDown/Move/Up }` | move/scale, later drawing |
| Panels | `PanelDef { id; title; slot; component }` | properties, adjustments |
| Frame sources | `FrameSource { id; label; pick(): Promise<Blob[]> }` | webcam, photo import |
| Storage | `ProjectRepository` | Dexie now, Supabase later |

The registry is the one place where the studio renders lists from data, the "dynamic data" exception in
`COMPONENT_PATTERNS.md`. Everything else composes content as JSX children.

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

Layers, audio tracks, titles/text, drawing on frames, chroma key, cloud sync and sharing, multi-user
editing, keyframe animation. The architecture leaves room for each; none is planned in the roadmap.
