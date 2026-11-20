import { describe, expect, it } from "vitest";
import { ARCHIVE_LIMITS, ArchiveError, archiveManifest, imageFile, readManifest } from "@/core/archive";
import { addStroke, createBubble, createFrame, createOverlay, createProject, createShape, createSoundClip, withProps, type Frame } from "@/core/model";

// The archive's format: what a backup says, and that reading one back trusts nothing in it.

let counter = 0;
const makeId = () => `new-${++counter}`;

function animation() {
  const project = { ...createProject({ name: "Dino walk", fps: 12, now: 100 }), safeMargin: 30 };
  const bubble = withProps(createBubble(), { text: "Hi!" });
  const a = createFrame(project.id, "img-a", { hold: 3, transform: { x: 0.1, y: -0.2, scale: 1.5, rotation: 30, flipX: true, flipY: false }, adjust: { brightness: 1.2, contrast: 0.8 }, elements: [bubble] });
  const b = createFrame(project.id, "img-b");
  const c = createFrame(project.id, "img-a", { hold: 2 });   // a copy: the same picture
  project.frameIds = [b.id, a.id, c.id];
  project.overlays = [createOverlay(createShape("arrow"), 2, 4)];
  project.sounds = [{ ...createSoundClip("cartoon/boing", 3), volume: 1.5 }];
  const images = [{ id: "img-a", width: 1280, height: 720 }, { id: "img-b", width: 1280, height: 720 }, { id: "unused", width: 10, height: 10 }];
  return { project, frames: [a, b, c], images };
}

const restore = (manifest: unknown, files?: string[]) => {
  const all = files ?? (manifest as { images: { file: string }[] }).images.map((image) => image.file);
  return readManifest(JSON.parse(JSON.stringify(manifest)), { files: new Set(all), now: 999, makeId });
};

describe("archiveManifest", () => {
  it("lists the frames in animation order with their picture, and each picture used once", () => {
    const { project, frames, images } = animation();
    const manifest = archiveManifest(project, frames, images);
    expect(manifest).toMatchObject({ format: "stop-motion-studio", version: 1 });
    expect(manifest.frames.map((frame) => [frame.image, frame.hold])).toEqual([["img-b", 1], ["img-a", 3], ["img-a", 2]]);
    expect(manifest.images.map((image) => image.file)).toEqual([imageFile("img-a"), imageFile("img-b")]);   // not the unused one
  });
});

describe("readManifest", () => {
  it("brings everything back: order, lengths, positions, looks, objects, overlays, sounds, speed, safe zone", () => {
    const { project, frames, images } = animation();
    const restored = restore(archiveManifest(project, frames, images));
    expect(restored.project).toMatchObject({ name: "Dino walk", width: 1280, height: 720, fps: 12, safeMargin: 30, createdAt: 100, updatedAt: 999 });
    const byId = new Map(restored.frames.map((frame) => [frame.id, frame]));
    const ordered = restored.project.frameIds.map((id) => byId.get(id)!) as Frame[];
    expect(ordered.map((frame) => frame.hold)).toEqual([1, 3, 2]);
    expect(ordered[1].transform).toEqual(frames[0].transform);
    expect(ordered[1].adjust).toEqual({ brightness: 1.2, contrast: 0.8 });
    expect(ordered[1].elements[0]).toMatchObject({ kind: "speech-bubble", props: { text: "Hi!" } });
    expect(ordered[1].imageId).toBe(ordered[2].imageId);   // the copy still shares its picture
    expect(restored.project.overlays).toEqual([expect.objectContaining({ start: 2, length: 4, element: expect.objectContaining({ kind: "shape" }) })]);
    expect(restored.project.sounds).toEqual([expect.objectContaining({ start: 3, sound: "cartoon/boing", volume: 1.5 })]);
  });

  it("keeps only real sounds from a backup, in range; a backup from before sounds has none", () => {
    const { project, frames, images } = animation();
    const manifest = archiveManifest(project, frames, images);
    manifest.project.sounds = [{ id: "s", start: -4, sound: "magic/zap", volume: 9 }, { id: "x", start: 1, sound: "", volume: 1 }, null as never, ...Array(ARCHIVE_LIMITS.sounds + 5).fill(project.sounds![0])];
    const restored = restore(manifest);
    expect(restored.project.sounds![0]).toEqual({ id: "s", start: 0, sound: "magic/zap", volume: 1 });
    expect(restored.project.sounds).toHaveLength(ARCHIVE_LIMITS.sounds - 2);   // at most that many are read, the two that aren't sounds among them
    delete manifest.project.sounds;
    expect(restore(manifest).project.sounds).toEqual([]);
  });

  it("gives the animation, its frames and its pictures new ids, so a restore never overwrites", () => {
    const { project, frames, images } = animation();
    const restored = restore(archiveManifest(project, frames, images));
    expect(restored.project.id).not.toBe(project.id);
    expect(restored.frames.every((frame) => frame.projectId === restored.project.id && !frames.some((old) => old.id === frame.id))).toBe(true);
    expect(restored.images.map((image) => [image.id.startsWith("new-"), image.file])).toEqual([[true, imageFile("img-a")], [true, imageFile("img-b")]]);
  });

  it("rejects what isn't a backup, one from a newer studio, and one missing a picture", () => {
    const { project, frames, images } = animation();
    const manifest = archiveManifest(project, frames, images);
    const problem = (raw: unknown, files?: string[]) => { try { restore(raw, files); } catch (error) { return error instanceof ArchiveError ? error.problem : "other"; } return "none"; };
    expect(problem({ hello: "world" }, [])).toBe("not-archive");
    expect(problem({ ...manifest, version: 2 })).toBe("newer");
    expect(problem(manifest, [imageFile("img-a")])).toBe("missing-pictures");
    expect(problem({ ...manifest, frames: [...manifest.frames, { ...manifest.frames[0], image: "nowhere" }] })).toBe("missing-pictures");
    expect(problem({ ...manifest, frames: Array(ARCHIVE_LIMITS.pictures + 1).fill(manifest.frames[0]) })).toBe("too-big");
  });

  it("keeps every value in range, and leaves out kinds of object it doesn't know", () => {
    const { project, frames, images } = animation();
    const manifest = archiveManifest(project, frames, images) as unknown as Record<string, unknown> & { project: Record<string, unknown>; frames: Record<string, unknown>[] };
    manifest.project = { ...manifest.project, name: "  ", width: 99999, height: -5, fps: "fast", safeMargin: 500 };
    manifest.frames[0] = { ...manifest.frames[0], hold: -3, transform: { x: 50, scale: 0, rotation: 725, flipX: "yes" }, adjust: { brightness: 9 }, elements: [{ kind: "hologram", box: { x: 0, y: 0, width: 1, height: 1, rotation: 0 }, props: {} }, { kind: "shape", box: { x: "a" }, props: { form: "star" } }] };
    const restored = restore(manifest);
    expect(restored.project).toMatchObject({ name: "My animation", width: 1920, height: 2, fps: 8, safeMargin: 60 });
    const first = restored.frames.find((frame) => frame.id === restored.project.frameIds[0])!;
    expect(first.hold).toBe(1);
    expect(first.transform).toEqual({ x: 2, y: 0, scale: 0.05, rotation: 5, flipX: false, flipY: false });
    expect(first.adjust).toEqual({ brightness: 1.5, contrast: 1 });
    expect(first.elements).toHaveLength(1);   // the hologram is gone
    expect(first.elements[0]).toMatchObject({ kind: "shape", box: { x: 0, y: 0 }, props: { form: "rectangle" } });
  });

  it("caps drawings, objects per picture and overlays", () => {
    const { project, frames, images } = animation();
    const line = addStroke(undefined, { points: [{ x: 1, y: 1 }, { x: 20, y: 20 }], colour: "#1d4ed8", width: "thick" }, { width: 1280, height: 720 });
    const huge = { ...line, props: { strokes: Array(ARCHIVE_LIMITS.strokes + 10).fill((line.props.strokes as unknown[])[0]) } };
    const manifest = archiveManifest(project, frames, images);
    manifest.frames[0].elements = [huge, ...Array(ARCHIVE_LIMITS.objects + 5).fill(createShape())];
    manifest.project.overlays = Array(ARCHIVE_LIMITS.overlays + 5).fill(project.overlays![0]);
    const restored = restore(manifest);
    const first = restored.frames.find((frame) => frame.id === restored.project.frameIds[0])!;
    expect(first.elements).toHaveLength(ARCHIVE_LIMITS.objects);
    expect((first.elements[0].props.strokes as unknown[]).length).toBe(ARCHIVE_LIMITS.strokes);
    expect(restored.project.overlays).toHaveLength(ARCHIVE_LIMITS.overlays);
  });
});
