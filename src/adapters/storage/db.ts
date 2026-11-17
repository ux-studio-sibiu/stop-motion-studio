import Dexie, { type EntityTable } from "dexie";
import type { Frame, Project, StoredImage, StoredThumb } from "@/core/model";

export const DB_NAME = "stop-motion-studio";

export type StudioDb = Dexie & {
  projects: EntityTable<Project, "id">;
  frames: EntityTable<Frame, "id">;
  images: EntityTable<StoredImage, "id">;
  thumbs: EntityTable<StoredThumb, "imageId">;
};

// The IndexedDB layout. Each string lists the primary key first, then the fields that are
// searched or sorted by; everything else in a record is stored but not indexed.
//   projects: listed newest first        frames / images / thumbs: fetched per project
// To change it later, add a version(2) with the new layout and an upgrade() that moves the
// data, never edit version(1): browsers that already have version 1 must be able to upgrade.
export function openStudioDb(name = DB_NAME): StudioDb {
  const db = new Dexie(name) as StudioDb;
  db.version(1).stores({
    projects: "id, updatedAt",
    frames: "id, projectId",
    images: "id, projectId",
    thumbs: "imageId, projectId",
  });
  // Frames saved before speech bubbles (step 23) have no `elements`: they read as having none,
  // so no migration is needed.
  db.frames.hook("reading", (frame) => (Array.isArray(frame.elements) ? frame : { ...frame, elements: [] }));
  return db;
}

let shared: StudioDb | null = null;

// The app's database, opened on first use. Never at import time: during `next build` (and
// server rendering) there is no IndexedDB, so code that merely imports this file must not
// touch it.
export function studioDb(): StudioDb {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB isn't available here (server rendering, or a very old browser).");
  shared ??= openStudioDb();
  return shared;
}
