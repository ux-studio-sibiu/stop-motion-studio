import "fake-indexeddb/auto";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportArchive, importArchive, type Decode } from "@/adapters/archive/projectArchive";
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
});
