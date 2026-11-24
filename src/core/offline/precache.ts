// What the service worker keeps for offline use (step 32), from the files of the static export
// (`out/`). Run by scripts/build-offline.mjs after `next build`; plain TypeScript with no imports, so
// Node runs it straight from the .ts file.
//
//   shell   stored when the worker installs, all or nothing: the pages, the code, the fonts, the
//           cardboard pieces. Small (a few MB), so the studio opens offline right after a first visit.
//   sounds  the recorded sound effects (24 MB), fetched afterwards in the background, and kept as
//           they're played, so an early offline moment doesn't wait on all of them.
// Left out: the build notes (/steps/), source maps, the not-found pages, the worker itself, and
// the demo animations (/demos/, a few MB): fetched once, on a first visit, into the browser's
// storage (src/projects/demos.ts).

export type OfflinePlan = { shell: string[]; sounds: string[] };

const LEFT_OUT = [/^steps\//, /^demos\//, /\.map$/, /^404\.html$/, /^_not-found(\.|\/)/, /^sw\.js$/];

// The URL a file of the export is served at. Pages are asked for by their clean name (/studio,
// not /studio.html), the way the app links to them, so that's what the worker stores them under.
export function urlForFile(file: string): string {
  const path = file.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  if (path.endsWith(".html")) return `/${path.slice(0, -".html".length)}`;
  return `/${path}`;
}

// The worker's two lists, from every file in the export (paths relative to `out/`), each sorted.
export function planPrecache(files: readonly string[]): OfflinePlan {
  const shell: string[] = [];
  const sounds: string[] = [];
  for (const file of files) {
    const path = file.replace(/\\/g, "/").replace(/^\.?\//, "");
    if (LEFT_OUT.some((pattern) => pattern.test(path))) continue;
    (path.startsWith("sounds/") ? sounds : shell).push(urlForFile(path));
  }
  return { shell: shell.sort(), sounds: sounds.sort() };
}

// The page a navigation is answered with: its clean name, whatever form it was asked in
// (/studio/, /studio.html), so /studio?project=... opens the stored studio.
export function pageKey(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "");
  return path === "" ? "/" : path;
}
