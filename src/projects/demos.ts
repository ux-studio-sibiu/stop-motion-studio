"use client";

import { useSyncExternalStore } from "react";
import { importArchives } from "@/adapters/archive/projectArchive";
import { decodePicture } from "@/adapters/images/thumbnail";
import { appRepository } from "@/adapters/storage/appRepository";
import { remembered } from "@/studio/remembered";

// The demo animations: a few finished animations that come with the studio, so anyone opening it
// has something to play and to change. They're a backup of all animations (Settings' Download all
// animations), with lighter photos, at public/demos/demos.zip. Restored like any backup: ordinary
// animations of this browser, to open, change or delete.
//
// Added once per browser, on the first visit to the home page (addDemosOnce), after the page is
// showing; deleted ones don't come back.
// Kept out of the offline worker's first download (core/offline/precache.ts): once added, they're
// in the browser's storage anyway.

const DEMOS = "/demos/demos.zip";

// Adds the demos not in yet as new animations, each remembered as soon as it's saved, so an
// interrupted first visit (closed, reloaded) adds the rest next time and none twice. Throws if the
// file can't be fetched (offline) or isn't a backup.
async function addDemos(): Promise<void> {
  const response = await fetch(DEMOS);
  if (!response.ok) throw new Error(`${DEMOS}: ${response.status}`);
  const done = () => remembered.demosRestored.read() ?? [];
  await importArchives(appRepository(), await response.blob(), {
    decode: decodePicture,
    skip: (name) => done().includes(name),
    onRestored: (name) => remembered.demosRestored.save([...done(), name]),
  });
}

// Whether the demos are being added now: the home page says so instead of "No animations yet".
let adding = false;
const listeners = new Set<() => void>();
function setAdding(now: boolean): void {
  adding = now;
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useAddingDemos = () => useSyncExternalStore(subscribe, () => adding, () => false);

// The first visit's demos: added unless this browser has had them all. Remembered as done only once
// they're in, so a first visit without the internet tries again next time. Two tabs opening at once
// add them once (a lock, where the browser has them).
let started = false;
export function addDemosOnce(): void {
  if (started || remembered.demosAdded.read()) return;
  started = true;
  setAdding(true);
  const add = async () => {
    if (remembered.demosAdded.read()) return;   // another tab, meanwhile
    await addDemos();
    remembered.demosAdded.save(true);
    remembered.demosRestored.save(null);
  };
  const locked = typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("stop-motion-studio:demos", add) : add();
  Promise.resolve(locked)
    .catch((error) => { started = false; console.warn("The demo animations couldn't be added", error); })
    .finally(() => setAdding(false));
}
