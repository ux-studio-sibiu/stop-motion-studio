import "fake-indexeddb/auto";   // an in-memory IndexedDB for Node, installed as the global `indexedDB`
import { afterEach, describe, expect, it } from "vitest";
import { createFrame, createProject } from "@/core/model";
import { openStudioDb, type StudioDb } from "@/adapters/storage/db";
import { createDexieRepository } from "@/adapters/storage/dexieRepository";
import { describeRepositoryContract } from "@/adapters/storage/repositoryContract";

const opened: StudioDb[] = [];

// A new database per test (unique name), deleted afterwards, so tests never share data.
function freshDb(): StudioDb {
  const db = openStudioDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

describeRepositoryContract("Dexie", async () => {
  let clock = 0;
  return { repository: createDexieRepository(freshDb(), () => clock), tick: (ms = 1) => { clock += ms; } };
});

describe("Dexie database", () => {
  it("has the version 1 tables and indexes", async () => {
    const db = freshDb();
    await db.open();
    expect(db.verno).toBe(1);
    expect(db.tables.map((table) => table.name).sort()).toEqual(["frames", "images", "projects", "thumbs"]);
    expect(db.frames.schema.indexes.map((index) => index.name)).toEqual(["projectId"]);
    expect(db.thumbs.schema.primKey.name).toBe("imageId");
  });

  it("rolls back every table when one write in a transaction fails", async () => {
    const db = freshDb();
    const repository = createDexieRepository(db);
    const project = createProject();
    await repository.createProject(project);
    const frame = createFrame(project.id, "img-1");
    // A thumb without its primary key makes bulkPut fail after the image was already written.
    const broken = { projectId: project.id, blob: new Blob() } as unknown as { imageId: string; projectId: string; blob: Blob };
    const image = { id: "img-1", projectId: project.id, blob: new Blob(), width: 1, height: 1, createdAt: 0 };

    await expect(repository.insertFrames(project.id, { frames: [frame], images: [image], thumbs: [broken] })).rejects.toThrow();

    expect(await db.images.count()).toBe(0);
    expect(await db.frames.count()).toBe(0);
    expect((await db.projects.get(project.id))?.frameIds).toEqual([]);
  });
});
