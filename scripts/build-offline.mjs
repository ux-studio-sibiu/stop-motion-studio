// Writes out/sw.js, the service worker (step 32), after `next build` (part of `npm run build`).
// The lists of what it keeps come from src/core/offline/precache.ts (Node runs the .ts directly).
// Each list gets a version, a hash of its files' contents: a build that changes any of them makes
// a new worker, which takes over open pages (a page opened offline then offers Update); one that
// changes no sound keeps the sounds already stored.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pageKey, planPrecache } from "../src/core/offline/precache.ts";

const OUT = "out";
const TEMPLATE = new URL("./sw.js", import.meta.url);

const files = readdirSync(OUT, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(OUT, join(entry.parentPath, entry.name)).replace(/\\/g, "/"));
const plan = planPrecache(files);

const fileOf = (url) => join(OUT, url === "/" ? "index.html" : files.includes(`${url.slice(1)}.html`) ? `${url.slice(1)}.html` : url.slice(1));
function version(urls, extra = "") {
  const hash = createHash("sha256").update(extra);
  for (const url of urls) hash.update(url).update(readFileSync(fileOf(url)));
  return hash.digest("hex").slice(0, 12);
}

const template = readFileSync(TEMPLATE, "utf8");
const precache = { version: version(plan.shell, template), soundsVersion: version(plan.sounds), shell: plan.shell, sounds: plan.sounds };
writeFileSync(join(OUT, "sw.js"), `const PRECACHE = ${JSON.stringify(precache)};\nconst pageKey = ${pageKey.toString()};\n\n${template}`);

const size = (urls) => urls.reduce((total, url) => total + readFileSync(fileOf(url)).length, 0) / 1e6;
console.log(`sw.js: ${plan.shell.length} files kept offline (${size(plan.shell).toFixed(1)} MB), then ${plan.sounds.length} sounds (${size(plan.sounds).toFixed(1)} MB); version ${precache.version}`);
