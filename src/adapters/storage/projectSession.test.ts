import "fake-indexeddb/auto";   // an in-memory IndexedDB for Node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFrame, createProject, type Project } from "@/core/model";
import { openStudioDb, type StudioDb } from "./db";
import { createDexieRepository } from "./dexieRepository";
import { discardEmptyProjects, openProjectSession } from "./projectSession";

// The clean-up only runs when no other tab has the animation open (Node has Web Locks too).

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
let next = 0;
const projectId = () => `project-${next++}`;

describe("openProjectSession", () => {
  it("cleans up when the animation opens and when it's left, if no one else has it open", async () => {
    const cleanUp = vi.fn(async () => {});
    const close = openProjectSession(projectId(), cleanUp);
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(1);
    close();
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(2);
  });

  it("doesn't clean up while another tab has the same animation open", async () => {
    const id = projectId();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    const closeFirst = openProjectSession(id, first);
    await settle();
    const closeSecond = openProjectSession(id, second);
    await settle();
    expect(second).not.toHaveBeenCalled();   // the first tab may still undo a delete

    closeFirst();
    await settle();
    expect(first).toHaveBeenCalledTimes(1);  // only its opening clean-up: the second tab is still there
    closeSecond();
    await settle();
    expect(second).toHaveBeenCalledTimes(1); // the last one out cleans up
  });

  it("another animation open elsewhere doesn't hold it back", async () => {
    const other = vi.fn(async () => {});
    const closeOther = openProjectSession(projectId(), other);
    const cleanUp = vi.fn(async () => {});
    const close = openProjectSession(projectId(), cleanUp);
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(1);
    close();
    closeOther();
  });

  it("does nothing without Web Locks", async () => {
    const cleanUp = vi.fn(async () => {});
    openProjectSession(projectId(), cleanUp, null)();
    await settle();
    expect(cleanUp).not.toHaveBeenCalled();
  });
});

describe("discardEmptyProjects", () => {
  const opened: StudioDb[] = [];
  afterEach(async () => { await Promise.all(opened.splice(0).map((db) => db.delete())); });

  const setUp = async () => {
    const db = openStudioDb(`test-${crypto.randomUUID()}`);
    opened.push(db);
    const repository = createDexieRepository(db);
    const add = async (name: string, pictures: number, now = 0): Promise<Project> => {
      const project = createProject({ name, now });
      await repository.createProject(project);
      if (pictures > 0) {
        const frames = Array.from({ length: pictures }, () => createFrame(project.id, crypto.randomUUID()));
        await repository.insertFrames(project.id, { frames, images: frames.map((frame) => ({ id: frame.imageId, projectId: project.id, blob: new Blob(["x"]), width: 1, height: 1, createdAt: 0 })) });
      }
      return project;
    };
    const names = async () => (await repository.listProjects()).map((project) => project.name).sort();
    return { repository, add, names };
  };

  it("deletes the animations without pictures and keeps the others", async () => {
    const { repository, add, names } = await setUp();
    const empty = await add("Empty", 0);
    await add("Dino walk", 2);
    expect(await discardEmptyProjects(repository)).toEqual([empty.id]);
    expect(await names()).toEqual(["Dino walk"]);
  });

  it("keeps an empty animation made just now (being opened)", async () => {
    const { repository, add, names } = await setUp();
    await add("New", 0, 5000);
    expect(await discardEmptyProjects(repository, { before: 1000 })).toEqual([]);
    expect(await names()).toEqual(["New"]);
  });

  it("keeps an empty animation open in a studio, and deletes it once the studio closes", async () => {
    const { repository, add, names } = await setUp();
    const empty = await add("Empty", 0);
    const close = openProjectSession(empty.id, async () => {});
    await settle();
    expect(await discardEmptyProjects(repository, { wait: 30 })).toEqual([]);
    expect(await names()).toEqual(["Empty"]);

    const sweep = discardEmptyProjects(repository, { wait: 1000 });   // waits for a studio that is closing
    close();
    expect(await sweep).toEqual([empty.id]);
    expect(await names()).toEqual([]);
  });

  it("deletes nothing without Web Locks", async () => {
    const { repository, add, names } = await setUp();
    await add("Empty", 0);
    expect(await discardEmptyProjects(repository, { locks: null })).toEqual([]);
    expect(await names()).toEqual(["Empty"]);
  });
});
