import "fake-indexeddb/auto";
import { strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportAllArchives, exportArchive, importArchive, importArchives, type Decode } from "@/adapters/archive/projectArchive";
import { openStudioDb, type StudioDb } from "@/adapters/storage/db";
import { createDexieRepository } from "@/adapters/storage/dexieRepository";
import { ArchiveError } from "@/core/archive";
import { createBubble, createFrame, createOverlay, createProject, createText, withProps, type ProjectRepository } from "@/core/model";

// Backing up and restoring against real storage (fake IndexedDB): what goes in comes back.
// Pictures are opened by a stand-in (`decode`): there's no image decoder in Node.

let db: StudioDb;
let repository: ProjectRepository;

beforeEach(() => {
  db = openStudioDb(`test-${crypto.randomUUID()}`);
  repository = createDexieRepository(db);
});
afterEach(() => db.delete());

const decode: Decode = async (blob) => {
  const text = await blob.text();
  if (!text.startsWith("jpeg")) throw new Error("not a picture");
  return { width: 1280, height: 720, thumb: new Blob([`thumb of ${text}`]) };
};

async function savedAnimation() {
  const project = { ...createProject({ name: "Dino walk", fps: 12, now: 0 }), safeMargin: 30, overlays: [createOverlay(createText("THE END"), 3, 5)] };
  const a = createFrame(project.id, "img-a", { hold: 4, transform: { x: 0.2, y: 0, scale: 1.3, rotation: 15, flipX: false, flipY: true }, elements: [withProps(createBubble(), { text: "Hello" })] });
  const b = createFrame(project.id, "img-b", { adjust: { brightness: 1.3, contrast: 1 } });
  const copy = createFrame(project.id, "img-a");
  project.frameIds = [a.id, b.id, copy.id];
  await repository.createProject({ ...project, frameIds: [] });
  await repository.insertFrames(project.id, {
    frames: [a, b, copy],
    images: ["img-a", "img-b"].map((id) => ({ id, projectId: project.id, blob: new Blob([`jpeg ${id}`]), width: 1280, height: 720, createdAt: 0 })),
    thumbs: ["img-a", "img-b"].map((id) => ({ imageId: id, projectId: project.id, blob: new Blob(["old thumb"]) })),
  });
  await repository.updateProject(project.id, { safeMargin: 30, overlays: project.overlays });
  return project;
}

describe("project archive", () => {
  it("backs up an animation and restores it as a new one with everything in place", async () => {
    const original = await savedAnimation();
    const { blob, name } = await exportArchive(repository, original.id);
    expect(name).toBe("Dino walk.zip");
    await repository.deleteProject(original.id);

    const restored = await importArchive(repository, blob, { decode, now: 50 });
    const loaded = (await repository.loadProject(restored.id))!;
    expect(loaded.project).toMatchObject({ name: "Dino walk", fps: 12, safeMargin: 30, updatedAt: 50 });
    expect(loaded.project.overlays).toEqual([expect.objectContaining({ start: 3, length: 5, element: expect.objectContaining({ kind: "text", props: expect.objectContaining({ text: "THE END" }) }) })]);
    const byId = new Map(loaded.frames.map((frame) => [frame.id, frame]));
    const frames = loaded.project.frameIds.map((id) => byId.get(id)!);
    expect(frames.map((frame) => frame.hold)).toEqual([4, 1, 1]);
    expect(frames[0].transform).toEqual({ x: 0.2, y: 0, scale: 1.3, rotation: 15, flipX: false, flipY: true });
    expect(frames[0].elements[0].props.text).toBe("Hello");
    expect(frames[1].adjust.brightness).toBe(1.3);
    expect(frames[2].imageId).toBe(frames[0].imageId);   // the copy still shares its picture
    expect(await (await repository.getImage(frames[1].imageId))!.text()).toBe("jpeg img-b");   // the photo itself
    expect(await (await repository.getThumb(frames[1].imageId))!.text()).toBe("thumb of jpeg img-b");   // made anew
  });

  it("pictures opened out of order still each get their own thumbnail", async () => {
    const original = await savedAnimation();
    const { blob } = await exportArchive(repository, original.id);
    // img-a takes longer to open than img-b, so img-b is done first.
    const slow: Decode = async (picture) => { const text = await picture.text(); await new Promise((resolve) => setTimeout(resolve, text.includes("img-a") ? 30 : 0)); return decode(picture); };
    const restored = await importArchive(repository, blob, { decode: slow });
    const loaded = (await repository.loadProject(restored.id))!;
    for (const frame of loaded.frames) {
      const photo = await (await repository.getImage(frame.imageId))!.text();
      expect(await (await repository.getThumb(frame.imageId))!.text()).toBe(`thumb of ${photo}`);
    }
  });

  it("a backup carries the thumbnails, and restoring keeps them instead of opening every photo", async () => {
    const jpeg = (text: string) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), text]);   // starts like a JPEG
    const project = createProject({ name: "Quick", now: 0 });
    const frame = createFrame(project.id, "img-q");
    await repository.createProject({ ...project, frameIds: [] });
    await repository.insertFrames(project.id, {
      frames: [frame],
      images: [{ id: "img-q", projectId: project.id, blob: jpeg("photo"), width: 1280, height: 720, createdAt: 0 }],
      thumbs: [{ imageId: "img-q", projectId: project.id, blob: jpeg("small") }],
    });
    const { blob } = await exportArchive(repository, project.id);
    expect(Object.keys(unzipSync(new Uint8Array(await blob.arrayBuffer())))).toContain("thumbs/img-q.jpg");

    const never: Decode = async () => { throw new Error("opened a photo"); };
    const restored = await importArchive(repository, blob, { decode: never });
    const loaded = (await repository.loadProject(restored.id))!;
    const thumb = await repository.getThumb(loaded.frames[0].imageId);
    expect((await thumb!.text()).endsWith("small")).toBe(true);
  });

  it("restoring twice makes two animations: it never overwrites", async () => {
    const original = await savedAnimation();
    const { blob } = await exportArchive(repository, original.id);
    const first = await importArchive(repository, blob, { decode });
    const second = await importArchive(repository, blob, { decode });
    expect(new Set([original.id, first.id, second.id]).size).toBe(3);
    expect(await repository.listProjects()).toHaveLength(3);
  });

  it("rejects a file that isn't a backup, or one with a broken picture, and saves nothing", async () => {
    const problem = async (file: Blob) => importArchive(repository, file, { decode }).then(() => "none", (error) => (error instanceof ArchiveError ? error.problem : "other"));
    expect(await problem(new Blob(["just some text"]))).toBe("not-archive");
    expect(await problem(new Blob([zipSync({ "notes.txt": strToU8("hi") }) as BlobPart]))).toBe("not-archive");

    const original = await savedAnimation();
    const { blob } = await exportArchive(repository, original.id);
    await repository.deleteProject(original.id);
    const failing: Decode = async (picture) => ((await picture.text()).includes("img-b") ? Promise.reject(new Error("broken")) : decode(picture));
    await expect(importArchive(repository, blob, { decode: failing })).rejects.toMatchObject({ problem: "missing-pictures" });
    expect(await repository.listProjects()).toEqual([]);   // all or nothing
  });

  it("backs up every animation in one file, each as its own backup, names kept apart", async () => {
    await savedAnimation();
    await savedAnimation();   // another "Dino walk"
    const { blob, name, count } = await exportAllArchives(repository, { now: new Date(2026, 10, 24) });
    expect(name).toBe("All animations 2026-11-24.zip");
    expect(count).toBe(2);
    const inside = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(inside).sort()).toEqual(["Dino walk (2).zip", "Dino walk.zip"]);
    expect(Object.keys(unzipSync(inside["Dino walk.zip"]))).toContain("project.json");
  });

  it("has nothing to back up with no animations", async () => {
    await expect(exportAllArchives(repository)).rejects.toThrow();
  });

  it("restores the backup of all animations: every one comes back, as new animations", async () => {
    await savedAnimation();
    await repository.createProject({ ...createProject({ name: "Cat", now: 0 }), frameIds: [] });
    const { blob } = await exportAllArchives(repository);
    for (const project of await repository.listProjects()) await repository.deleteProject(project.id);

    const { restored, failed } = await importArchives(repository, blob, { decode });
    expect(failed).toBe(0);
    expect(restored.map((project) => project.name).sort()).toEqual(["Cat", "Dino walk"]);
    const dino = restored.find((project) => project.name === "Dino walk")!;
    expect((await repository.loadProject(dino.id))?.frames).toHaveLength(3);
  });

  it("restores one animation's backup too, and the others of a bundle when one is broken", async () => {
    const original = await savedAnimation();
    const { blob: single } = await exportArchive(repository, original.id);
    expect((await importArchives(repository, single, { decode })).restored.map((project) => project.name)).toEqual(["Dino walk"]);

    const bundle = zipSync({ "Dino walk.zip": new Uint8Array(await single.arrayBuffer()), "Broken.zip": strToU8("not a zip") });
    const { restored, failed } = await importArchives(repository, new Blob([bundle as BlobPart]), { decode });
    expect(restored).toHaveLength(1);
    expect(failed).toBe(1);
  });

  it("restoring a bundle can leave animations out by name, and says each one's name as it's saved", async () => {
    await savedAnimation();
    await repository.createProject({ ...createProject({ name: "Cat", now: 0 }), frameIds: [] });
    const { blob } = await exportAllArchives(repository);
    for (const project of await repository.listProjects()) await repository.deleteProject(project.id);

    const saved: string[] = [];
    const { restored } = await importArchives(repository, blob, { decode, skip: (name) => name === "Dino walk.zip", onRestored: (name) => saved.push(name) });
    expect(restored.map((project) => project.name)).toEqual(["Cat"]);
    expect(saved).toEqual(["Cat.zip"]);
  });

  it("rejects a file that's neither kind of backup", async () => {
    await expect(importArchives(repository, new Blob([zipSync({ "notes.txt": strToU8("hi") }) as BlobPart]), { decode })).rejects.toMatchObject({ problem: "not-archive" });
    await expect(importArchives(repository, new Blob(["just text"]), { decode })).rejects.toMatchObject({ problem: "not-archive" });
  });
});
