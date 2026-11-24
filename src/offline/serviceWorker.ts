"use client";

import { useSyncExternalStore } from "react";

// The page's side of the service worker (step 32; the worker is scripts/sw.js): registers it,
// notices when a page opened offline is behind a new version, and keeps the browser's install offer.
//
// Online, every page comes fresh from the network, so it's always the latest and never asks. Only a
// page the worker answered from its cache (no internet, or too slow) can be older: when a newer
// worker takes over while it's open, it offers Update.
// Started once by <OfflineSupport> in the root layout; read with useOffline().
//
// Only in a production build: the dev server has no /sw.js, and a worker there would serve old
// files while editing.

export type OfflineState = {
  ready: boolean;       // this page runs from the stored app: it opens without the internet
  update: boolean;      // this page came from the cache, and a newer version has since taken over
  canInstall: boolean;  // the browser offers to install the studio as an app
};

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let state: OfflineState = { ready: false, update: false, canInstall: false };
let installPrompt: InstallPrompt | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(change: Partial<OfflineState>): void {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

export function startOffline(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; set({ canInstall: true }); });
  addEventListener("appinstalled", () => { installPrompt = null; set({ canInstall: false }); });

  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  const workers = navigator.serviceWorker;
  // Asked of the worker that answered this page, before any newer one takes over.
  const fromCache = workers.controller ? servedFromCache(workers.controller) : Promise.resolve(false);
  workers.register("/sw.js").then((found) => {
    // A studio left open for days, or opened offline, hears about a new version when it's looked at
    // again or the internet comes back.
    const check = () => found.update().catch(() => {});
    addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    addEventListener("online", check);
  }).catch(() => {});   // blocked (private window, a test): the studio works online as before
  workers.ready.then((active) => {
    set({ ready: Boolean(workers.controller) });
    active.active?.postMessage("fill-sounds");   // the sound effects, in the background
  });
  // A worker taking over: the first one (nothing changes for this page), or a newer version.
  const hadWorker = Boolean(workers.controller);
  workers.addEventListener("controllerchange", () => {
    set({ ready: true });
    if (hadWorker) fromCache.then((cached) => { if (cached) set({ update: true }); });
  });
}

// Whether the worker answered this page from its cache (it notes those, by tab).
function servedFromCache(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data === "cache");
    worker.postMessage("served", [channel.port2]);
    setTimeout(() => resolve(false), 3000);   // no answer: as if fresh
  });
}

// Loads the new version: the newer worker runs already, so a reload is enough (fresh from the
// network when there is one). The animations are saved as they change, so nothing is lost.
export function applyUpdate(): void {
  location.reload();
}

// Shows the browser's own install window.
export async function install(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  set({ canInstall: false });
  await prompt.prompt();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const SERVER: OfflineState = { ready: false, update: false, canInstall: false };
export const useOffline = () => useSyncExternalStore(subscribe, () => state, () => SERVER);
