// The studio's service worker (step 32): it keeps the app on this device so it opens and works
// without the internet. Not served as it is: scripts/build-offline.mjs writes out/sw.js from it,
// with PRECACHE (the lists from core/offline/precache.ts and a version for each) and pageKey (from
// the same file, tested there) put in front.
//
// The animations themselves are in IndexedDB already; this only keeps the app's own files.
//
//   install   stores the shell, all or nothing, then takes over straight away: online, the pages
//             are fetched fresh anyway, so there's nothing to wait for.
//   activate  drops the caches of older versions, then takes over open pages.
//   fetch     online first: pages and every other file without a hash in its name come from the
//             network, and from the cache only when there's no network (or it takes over
//             NETWORK_WAIT). The code chunks (/_next/static/, a hash in each name, never changed)
//             come from the cache first. Sounds from their own cache, stored as they're fetched.
//             A page answered from the cache is noted (SERVED), by its tab.
//   message   "fill-sounds": fetch the sounds not stored yet. "served": answers whether the asking
//             tab's page came from the cache; such a page shows the Update notice when a newer
//             worker takes over (src/offline/serviceWorker.ts). A page from the network is the
//             latest already, so it never does.

/* global PRECACHE, pageKey */

const SHELL = `studio-shell-${PRECACHE.version}`;
const SOUNDS = `studio-sounds-${PRECACHE.soundsVersion}`;
const SERVED = "studio-served";   // the tabs whose page came from the cache: /served/<tab id>
const NETWORK_WAIT = 4000;        // ms: a page slower than this on bad Wi-Fi comes from the cache instead

// A response copied into a fresh one, with no address of its own, so it takes its request's. For
// one that followed a redirect (it can't answer a page request as it is), and for a worker script,
// which must keep its request's fragment: Next's worker reads its settings from #params= (the GIF
// encoder).
async function asFresh(response) {
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function store(cache, url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  await cache.put(url, response.redirected ? await asFresh(response) : response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => Promise.all(PRECACHE.shell.map((url) => store(cache, url)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("studio-") && ![SHELL, SOUNDS, SERVED].includes(name)) await caches.delete(name);
    }
    // Notes of tabs that are closed.
    const open = new Set((await self.clients.matchAll()).map((client) => client.id));
    const served = await caches.open(SERVED);
    for (const key of await served.keys()) if (!open.has(new URL(key.url).pathname.slice("/served/".length))) await served.delete(key);
    await self.clients.claim();
  })());
});

// The sounds not stored yet, a few at a time; one that fails is tried again next time.
async function fillSounds() {
  const cache = await caches.open(SOUNDS);
  const missing = [];
  for (const url of PRECACHE.sounds) if (!(await cache.match(url))) missing.push(url);
  const next = async () => {
    for (let url = missing.shift(); url; url = missing.shift()) await store(cache, url).catch(() => {});
  };
  await Promise.all([next(), next(), next(), next()]);
}

self.addEventListener("message", (event) => {
  if (event.data === "fill-sounds") event.waitUntil(fillSounds());
  if (event.data === "served" && event.source) {
    event.waitUntil(caches.open(SERVED).then((served) => served.match(`/served/${event.source.id}`)).then((note) => event.ports[0]?.postMessage(note ? "cache" : "network")));
  }
});

// A stored file answers whatever its request's headers (stored ones say Vary: Accept-Encoding, and
// a script or a prefetch doesn't always ask the same way).
const ANY = { ignoreSearch: true, ignoreVary: true };

// From the network, unless it fails or takes longer than NETWORK_WAIT: then null.
async function fromNetwork(request) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), NETWORK_WAIT); });
  try { return await Promise.race([fetch(request), late]); } catch { return null; } finally { clearTimeout(timer); }
}

async function respond(event, request, url) {
  const shell = await caches.open(SHELL);
  if (request.mode === "navigate") {
    const fresh = await fromNetwork(request);
    if (fresh) return fresh;
    const page = (await shell.match(pageKey(url.pathname), ANY)) ?? (await shell.match("/", ANY));
    if (!page) return fetch(request);   // not stored: as the browser would without a worker
    if (event.resultingClientId) await caches.open(SERVED).then((served) => served.put(`/served/${event.resultingClientId}`, new Response("cache")));
    return page;
  }
  const hashed = url.pathname.startsWith("/_next/static/");
  const stored = await shell.match(request, ANY);
  if (stored && hashed) return request.destination === "worker" ? asFresh(stored) : stored;
  if (stored) return (await fromNetwork(request)) ?? stored;
  if (url.pathname.startsWith("/sounds/")) {
    const sounds = await caches.open(SOUNDS);
    const sound = await sounds.match(url.pathname, ANY);
    if (sound) return sound;
    const response = await fetch(request);
    if (response.ok) await sounds.put(url.pathname, response.clone());
    return response;
  }
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/steps/")) return;   // the build notes: always fresh
  event.respondWith(respond(event, request, url));
});
