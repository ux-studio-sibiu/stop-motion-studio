# Stop-motion Studio

A stop-motion studio for kids that runs in the browser: take pictures with the webcam, arrange them on
a timeline, play them back and export a GIF or video. No accounts, and photos never leave the device.

> Work in progress, built one reviewable step at a time. [PLAN.md](PLAN.md) has the architecture and
> decisions, [ROADMAP.md](ROADMAP.md) the steps. Each finished step has its own page in
> [`public/steps/`](public/steps/index.html), served by the app at `/steps/index.html`.

## Stack

Next.js (App Router, static export) · React · TypeScript · SCSS · Zustand · Dexie (IndexedDB) ·
Vitest. Later: gifenc, Mediabunny, fflate.

## Layout

```
src/app/        routes: projects list, studio
src/core/       plain TypeScript: model, commands, playback, renderer, registry (no React/Next/Dexie)
src/adapters/   browser and library code behind core interfaces: storage, camera, encoders
src/store/      Zustand editor state
src/studio/     studio components and their SCSS
src/features/   built-in plugins
src/styles/     tokens, breakpoints, globals
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
| `npm run build` | Static site in `out/` |
| `npm start` | Serves `out/` locally |
| `npm test` | Vitest in Node, once (`npm run test:watch` to keep it running) |
| `npm run test:browser` | Vitest browser mode in Chromium: the renderer's pixel tests (`*.browser.test.ts`) |
| `npm run lint` | ESLint, including the layering rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright end-to-end tests in Chromium (builds and serves the app on port 3200); add a file to run one spec: `npm run test:e2e -- e2e/timeline.spec.ts` |
| `npm run test:e2e:all` | The same in Chromium and WebKit: on request, or for Safari-specific changes |
| `npm run test:e2e:ui` | The same in Playwright's UI mode, test by test |
| `npm run test:e2e:report` | Opens the last HTML report |

The webcam needs a secure context: `localhost` works, a LAN IP over plain `http://` does not.

## Conventions

`STYLE_GUIDE.md` (synced from the workspace) and `COMPONENT_PATTERNS.md`: `nsc-` on component roots
only, no BEM `__` / `--` classes, hyphenated class names, content as JSX children.
