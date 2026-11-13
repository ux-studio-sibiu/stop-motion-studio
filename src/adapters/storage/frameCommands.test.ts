import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addFrames, createHistory, deleteFrames, type History } from "@/core/commands";
import { createFrame, createProject, type Project, type ProjectRepository } from "@/core/model";
import { openStudioDb, type StudioDb } from "@/adapters/storage/db";
import { createDexieRepository } from "@/adapters/storage/dexieRepository";

// The frame commands against real storage: do → undo → redo must land on exactly the saved
// state it started from, every time.

let db: StudioDb;
let repository: ProjectRepository;
let history: History;
let project: Project;

beforeEach(async () => {
  db = openStudioDb(`test-${crypto.randomUUID()}`);
  repository = createDexieRepository(db);
  history = createHistory(repository);
  project = createProject({ name: "Dino walk" });
  await repository.createProject(project);
});

afterEach(() => db.delete());

const capture = () => {
  const imageId = crypto.randomUUID();
  const frame = createFrame(project.id, imageId);
  return addFrames(project.id, {
    frames: [frame],
    images: [{ id: imageId, projectId: project.id, blob: new Blob(["jpeg"]), width: 1280, height: 720, createdAt: 0 }],
    thumbs: [{ imageId, projectId: project.id, blob: new Blob(["thumb"]) }],
  });
};

const order = async () => (await repository.getProject(project.id))?.frameIds ?? [];
const frameCount = async () => (await repository.loadProject(project.id))?.frames.length;

async function takePictures(count: number): Promise<string[]> {
  for (let i = 0; i < count; i++) await history.run(capture());
  return order();
}

describe("addFrames (a capture)", () => {
  it("adds the picture; undo takes it out, keeping its photo; redo puts it back", async () => {
    const [id] = await takePictures(1);
    const imageId = (await repository.loadProject(project.id))?.frames[0].imageId ?? "";

    await history.undo();
    expect(await order()).toEqual([]);
    expect(await frameCount()).toBe(0);
    expect(await repository.getImage(imageId)).toBeDefined();

    await history.redo();
    expect(await order()).toEqual([id]);
    expect(await repository.getThumb(imageId)).toBeDefined();
  });
});

describe("deleteFrames", () => {
  it("deletes pictures; undo puts them back in place; redo deletes them again", async () => {
    const ids = await takePictures(5);
    await history.run(deleteFrames(project.id, [ids[1], ids[3], ids[4]]));
    expect(await order()).toEqual([ids[0], ids[2]]);
    expect(await frameCount()).toBe(2);

    await history.undo();
    expect(await order()).toEqual(ids);
    expect(await frameCount()).toBe(5);

    await history.redo();
    expect(await order()).toEqual([ids[0], ids[2]]);
    await history.undo();
    expect(await order()).toEqual(ids);
  });

  it("three deletes, three undos: back where it started", async () => {
    const ids = await takePictures(4);
    for (const id of [ids[0], ids[2], ids[3]]) await history.run(deleteFrames(project.id, [id]));
    expect(await order()).toEqual([ids[1]]);
    for (let i = 0; i < 3; i++) await history.undo();
    expect(await order()).toEqual(ids);
  });

  it("keeps every frame's settings through the round trip", async () => {
    const [id] = await takePictures(1);
    const before = (await repository.loadProject(project.id))?.frames[0];
    await history.run(deleteFrames(project.id, [id]));
    await history.undo();
    expect((await repository.loadProject(project.id))?.frames[0]).toEqual(before);
  });

  it("isn't recorded when the pictures are already gone", async () => {
    const ids = await takePictures(2);
    await history.run(deleteFrames(project.id, [ids[0]]));
    await expect(history.run(deleteFrames(project.id, [ids[0]]))).rejects.toThrow();
    await history.undo();
    expect(await order()).toEqual(ids);
    expect(history.state().canUndo).toBe(true);   // the capture before it, not a do-nothing step
    expect(history.state().undoLabel).toBe("Take picture");
  });

  it("selects the restored pictures on undo", async () => {
    const ids = await takePictures(3);
    await history.run(deleteFrames(project.id, [ids[0], ids[2]]));
    expect(await history.undo()).toEqual({ select: [ids[0], ids[2]] });
  });

  it("undo then a capture: redo is gone, and the deleted pictures came back", async () => {
    const ids = await takePictures(2);
    await history.run(deleteFrames(project.id, [ids[0]]));
    await history.undo();
    await history.run(capture());
    expect(history.state().canRedo).toBe(false);
    expect((await order()).slice(0, 2)).toEqual(ids);
  });
});
