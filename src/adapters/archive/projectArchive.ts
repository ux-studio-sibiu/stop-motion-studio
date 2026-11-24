import { strFromU8, strToU8, unzip, zip, type Unzipped, type UnzipFileInfo } from "fflate";
import { ARCHIVE_LIMITS, ArchiveError, archiveManifest, imageFile, readManifest } from "@/core/archive";
import { exportFileName, uniqueFileNames } from "@/core/export";
import type { Project, ProjectRepository, StoredImage, StoredThumb } from "@/core/model";

// Backing up and restoring an animation as a .zip (step 27), with fflate: `project.json` (the
// archive's format, core/archive) and the photos as stored, `images/<id>.jpg`. Photos are
// stored as they are (JPEG doesn't shrink further); the JSON is compressed.
//
// The backup of all animations (Settings) is a .zip of those backups, one per animation, each as it
// would be on its own (`<name>.zip`). Load project takes either kind.

const MANIFEST = "project.json";

// A backup of the animation: everything needed to bring it back, on this device or another.
export async function exportArchive(repository: ProjectRepository, projectId: string): Promise<{ blob: Blob; name: string }> {
  const loaded = await repository.loadProject(projectId);
  if (!loaded) throw new Error("That animation doesn't exist.");
  const ids = [...new Set(loaded.frames.map((frame) => frame.imageId))];
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  const images: { id: string; width: number; height: number }[] = [];
  for (const id of ids) {
    const blob = await repository.getImage(id);
    if (!blob) continue;   // a picture lost from storage: its frames can't come back
    files[imageFile(id)] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    images.push({ id, width: loaded.project.width, height: loaded.project.height });
  }
  const manifest = archiveManifest(loaded.project, loaded.frames.filter((frame) => files[imageFile(frame.imageId)]), images);
  const bytes = await new Promise<Uint8Array>((resolve, reject) => zip({ ...files, [MANIFEST]: strToU8(JSON.stringify(manifest)) }, (error, data) => (error ? reject(error) : resolve(data))));
  return { blob: new Blob([bytes as BlobPart], { type: "application/zip" }), name: exportFileName(loaded.project.name, "zip") };
}

// A picture as read back: its real size and a thumbnail. Throws if the file isn't a picture.
export type Decode = (blob: Blob) => Promise<{ width: number; height: number; thumb: Blob }>;

// Restores a backup as a new animation (new ids: it never overwrites) and returns it. Everything is
// checked first (core/archive: readManifest) and every picture opened (`decode`, which also makes
// its thumbnail); only then is it all saved, in one go. Anything wrong saves nothing and throws an
// ArchiveError, whose message says why.
export async function importArchive(repository: ProjectRepository, file: Blob, { decode, now = Date.now() }: { decode: Decode; now?: number }): Promise<Project> {
  const zipped = new Uint8Array(await file.arrayBuffer());
  let total = 0;
  let tooBig = false;
  // Only what an archive holds, and nothing unpacked beyond the limits (a "zip bomb" stays packed).
  const wanted = (info: UnzipFileInfo) => {
    if (info.name !== MANIFEST && !/^images\/[^/]+\.jpg$/.test(info.name)) return false;
    total += info.originalSize;
    if (info.originalSize > (info.name === MANIFEST ? 64 * 1024 * 1024 : ARCHIVE_LIMITS.imageBytes) || total > ARCHIVE_LIMITS.totalBytes) { tooBig = true; return false; }
    return true;
  };
  let entries: Unzipped;
  try {
    entries = await new Promise<Unzipped>((resolve, reject) => unzip(zipped, { filter: wanted }, (error, data) => (error ? reject(error) : resolve(data))));
  } catch {
    throw new ArchiveError("not-archive");
  }
  if (tooBig) throw new ArchiveError("too-big");
  if (!entries[MANIFEST]) throw new ArchiveError("not-archive");

  let json: unknown;
  try { json = JSON.parse(strFromU8(entries[MANIFEST])); } catch { throw new ArchiveError("not-archive"); }
  const restored = readManifest(json, { files: new Set(Object.keys(entries)), now });

  const images: StoredImage[] = [];
  const thumbs: StoredThumb[] = [];
  for (const picture of restored.images) {
    const blob = new Blob([entries[picture.file] as BlobPart], { type: "image/jpeg" });
    let opened: Awaited<ReturnType<Decode>>;
    try { opened = await decode(blob); } catch { throw new ArchiveError("missing-pictures"); }   // not a picture after all
    images.push({ id: picture.id, projectId: restored.project.id, blob, width: opened.width, height: opened.height, createdAt: now });
    thumbs.push({ imageId: picture.id, projectId: restored.project.id, blob: opened.thumb });
  }
  await repository.importProject({ project: restored.project, frames: restored.frames, images, thumbs });
  return restored.project;
}

// A backup of every animation on this device: one .zip holding each one's own backup. Throws if
// there are none.
export async function exportAllArchives(repository: ProjectRepository, { now = new Date() }: { now?: Date } = {}): Promise<{ blob: Blob; name: string; count: number }> {
  const projects = await repository.listProjects();
  if (projects.length === 0) throw new Error("There are no animations to back up.");
  const names = uniqueFileNames(projects.map((project) => exportFileName(project.name, "zip")));
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [index, project] of projects.entries()) {
    const { blob } = await exportArchive(repository, project.id);
    files[names[index]] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];   // zipped already
  }
  const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, (error, data) => (error ? reject(error) : resolve(data))));
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { blob: new Blob([bytes as BlobPart], { type: "application/zip" }), name: `All animations ${day}.zip`, count: projects.length };
}

// Restores a backup of either kind: one animation, or all of them (each its own backup inside).
// Each animation is restored on its own, all or nothing (importArchive): one that can't be is
// counted in `failed` and the rest still come back. A file that's neither kind throws an
// ArchiveError, and so does a single backup that can't be restored.
export async function importArchives(repository: ProjectRepository, file: Blob, options: { decode: Decode; now?: number }): Promise<{ restored: Project[]; failed: number }> {
  const zipped = new Uint8Array(await file.arrayBuffer());
  const names: string[] = [];
  let total = 0;
  try {
    // A first look at the names only (nothing unpacked): which kind it is, and its unpacked size.
    await new Promise<Unzipped>((resolve, reject) => unzip(zipped, { filter: (info) => { names.push(info.name); total += info.originalSize; return false; } }, (error, data) => (error ? reject(error) : resolve(data))));
  } catch {
    throw new ArchiveError("not-archive");
  }
  if (names.includes(MANIFEST)) return { restored: [await importArchive(repository, file, options)], failed: 0 };

  const inner = names.filter((name) => /^[^/]+.zip$/i.test(name));
  if (inner.length === 0) throw new ArchiveError("not-archive");
  if (total > ARCHIVE_LIMITS.totalBytes) throw new ArchiveError("too-big");
  const restored: Project[] = [];
  let failed = 0;
  for (const name of inner) {   // one at a time, so only one animation is unpacked at once
    const entries = await new Promise<Unzipped>((resolve, reject) => unzip(zipped, { filter: (info) => info.name === name }, (error, data) => (error ? reject(error) : resolve(data))));
    try {
      restored.push(await importArchive(repository, new Blob([entries[name] as BlobPart]), options));
    } catch (error) {
      if (!(error instanceof ArchiveError)) throw error;   // storage failing: stop, say so
      failed++;
    }
  }
  return { restored, failed };
}
