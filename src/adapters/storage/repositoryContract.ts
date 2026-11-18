import { beforeEach, describe, expect, it } from "vitest";
import { createFrame, createProject, type Frame, type Project, type ProjectRepository, type StoredImage, type StoredThumb } from "@/core/model";

// What every ProjectRepository must do, whatever it stores into. Each implementation's test
// file calls this with a way to make a fresh, empty repository, plus its own extra tests.
// `tick` moves the repository's clock forward, so updatedAt is predictable.
export type RepositorySetup = { repository: ProjectRepository; tick: (ms?: number) => void };

export function describeRepositoryContract(name: string, setup: () => Promise<RepositorySetup>) {
  describe(`${name}: ProjectRepository contract`, () => {
    let repository: ProjectRepository;
    let tick: RepositorySetup["tick"];
    let project: Project;

    beforeEach(async () => {
      ({ repository, tick } = await setup());
      project = createProject({ name: "Dino walk", now: 0 });
      await repository.createProject(project);
    });

    const picture = (projectId: string): { frame: Frame; image: StoredImage; thumb: StoredThumb } => {
      const imageId = crypto.randomUUID();
      return {
        frame: createFrame(projectId, imageId),
        image: { id: imageId, projectId, blob: new Blob(["jpeg"], { type: "image/jpeg" }), width: 1280, height: 720, createdAt: 0 },
        thumb: { imageId, projectId, blob: new Blob(["thumb"], { type: "image/jpeg" }) },
      };
    };

    const capture = (projectId: string, at?: number) => {
      const { frame, image, thumb } = picture(projectId);
      return repository.insertFrames(projectId, { frames: [frame], images: [image], thumbs: [thumb], at }).then((saved) => ({ saved, frame }));
    };

    it("creates and reads a project", async () => {
      expect(await repository.getProject(project.id)).toEqual(project);
      expect(await repository.getProject("missing")).toBeUndefined();
    });

    it("lists projects newest first", async () => {
      tick(10);
      const newer = createProject({ name: "Robot dance", now: 5 });
      await repository.createProject(newer);
      await repository.updateProject(project.id, { name: "Dino walk 2" });   // now the newest (updatedAt 10)
      expect((await repository.listProjects()).map((p) => p.name)).toEqual(["Dino walk 2", "Robot dance"]);
    });

    it("updates fields and bumps updatedAt", async () => {
      tick(42);
      const saved = await repository.updateProject(project.id, { name: "Cat jump", fps: 12 });
      expect(saved).toMatchObject({ name: "Cat jump", fps: 12, updatedAt: 42, createdAt: 0 });
      expect(await repository.getProject(project.id)).toEqual(saved);
    });

    it("refuses to update a project that doesn't exist", async () => {
      await expect(repository.updateProject("missing", { name: "x" })).rejects.toThrow();
    });

    it("adds captured frames with their pictures, in order", async () => {
      const first = await capture(project.id);
      const second = await capture(project.id);
      const middle = await capture(project.id, 1);
      expect(middle.saved.frameIds).toEqual([first.frame.id, middle.frame.id, second.frame.id]);

      const loaded = await repository.loadProject(project.id);
      expect(loaded?.project.frameIds).toEqual(middle.saved.frameIds);
      expect(loaded?.frames.map((f) => f.id).sort()).toEqual([first.frame.id, second.frame.id, middle.frame.id].sort());
    });

    it("adds frames right after a given frame, or at the end when it's gone", async () => {
      const first = await capture(project.id);
      const second = await capture(project.id);
      const { frame } = picture(project.id);
      const saved = await repository.insertFrames(project.id, { frames: [frame], after: first.frame.id, at: 0 });   // after wins
      expect(saved.frameIds).toEqual([first.frame.id, frame.id, second.frame.id]);
      const { frame: last } = picture(project.id);
      expect((await repository.insertFrames(project.id, { frames: [last], after: "gone" })).frameIds.at(-1)).toBe(last.id);
    });

    it("keeps photos as Blobs and lists the project's thumbnails", async () => {
      const { frame } = await capture(project.id);
      const image = await repository.getImage(frame.imageId);
      expect(image).toBeInstanceOf(Blob);
      expect(await image?.text()).toBe("jpeg");
      expect(await (await repository.getThumb(frame.imageId))?.text()).toBe("thumb");
      expect((await repository.listThumbs(project.id)).map((t) => t.imageId)).toEqual([frame.imageId]);
    });

    it("adds a duplicate that shares an existing picture", async () => {
      const { frame } = await capture(project.id);
      const copy = createFrame(project.id, frame.imageId);
      const saved = await repository.insertFrames(project.id, { frames: [copy] });
      expect(saved.frameIds).toEqual([frame.id, copy.id]);
      expect(await repository.listThumbs(project.id)).toHaveLength(1);
    });

    it("bumps updatedAt when frames are added", async () => {
      tick(7);
      const { saved } = await capture(project.id);
      expect(saved.updatedAt).toBe(7);
    });

    it("refuses frames of another project and saves nothing", async () => {
      const other = createProject();
      await repository.createProject(other);
      const stray = picture(other.id);
      await expect(repository.insertFrames(project.id, { frames: [stray.frame], images: [stray.image], thumbs: [stray.thumb] })).rejects.toThrow();
      expect((await repository.getProject(project.id))?.frameIds).toEqual([]);
      expect(await repository.getImage(stray.image.id)).toBeUndefined();
    });

    it("removes frames, keeps their pictures, and says where they were", async () => {
      const [a, b, c] = [await capture(project.id), await capture(project.id), await capture(project.id)];
      tick(5);
      const { project: saved, removed } = await repository.removeFrames(project.id, [c.frame.id, a.frame.id, "missing"]);
      expect(saved.frameIds).toEqual([b.frame.id]);
      expect(saved.updatedAt).toBe(5);
      expect(removed).toEqual([{ frame: a.frame, index: 0 }, { frame: c.frame, index: 2 }]);
      expect((await repository.loadProject(project.id))?.frames.map((f) => f.id)).toEqual([b.frame.id]);
      expect(await repository.getImage(a.frame.imageId)).toBeDefined();   // undo needs it
      expect(await repository.getThumb(c.frame.imageId)).toBeDefined();
    });

    it("restores removed frames exactly where they were", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) ids.push((await capture(project.id)).frame.id);
      const { removed } = await repository.removeFrames(project.id, [ids[0], ids[2], ids[4]]);
      const saved = await repository.restoreFrames(project.id, removed);
      expect(saved.frameIds).toEqual(ids);
      const loaded = await repository.loadProject(project.id);
      expect(loaded?.frames.map((f) => f.id).sort()).toEqual([...ids].sort());
      expect(loaded?.frames.find((f) => f.id === ids[2])).toEqual(removed[1].frame);
    });

    it("updates frames' length and look together, and bumps updatedAt", async () => {
      const [a, b] = [await capture(project.id), await capture(project.id)];
      tick(9);
      const saved = await repository.updateFrames(project.id, [{ id: a.frame.id, hold: 4 }, { id: b.frame.id, adjust: { brightness: 1.2, contrast: 1 } }]);
      expect(saved.updatedAt).toBe(9);
      expect(saved.frameIds).toEqual([a.frame.id, b.frame.id]);
      const frames = (await repository.loadProject(project.id))?.frames ?? [];
      expect(frames.find((f) => f.id === a.frame.id)).toEqual({ ...a.frame, hold: 4 });
      expect(frames.find((f) => f.id === b.frame.id)).toEqual({ ...b.frame, adjust: { brightness: 1.2, contrast: 1 } });
    });

    it("refuses to update a frame that isn't in the project, and saves nothing", async () => {
      const mine = await capture(project.id);
      const other = createProject();
      await repository.createProject(other);
      const theirs = await capture(other.id);
      await expect(repository.updateFrames(project.id, [{ id: mine.frame.id, hold: 3 }, { id: theirs.frame.id, hold: 3 }])).rejects.toThrow();
      await expect(repository.updateFrames(project.id, [{ id: "missing", hold: 3 }])).rejects.toThrow();
      expect((await repository.loadProject(project.id))?.frames[0].hold).toBe(1);
      expect((await repository.loadProject(other.id))?.frames[0].hold).toBe(1);
    });

    it("refuses to restore frames of another project and saves nothing", async () => {
      const other = createProject();
      await repository.createProject(other);
      const theirs = await capture(other.id);
      const { removed } = await repository.removeFrames(other.id, [theirs.frame.id]);
      await expect(repository.restoreFrames(project.id, removed)).rejects.toThrow();
      expect((await repository.getProject(project.id))?.frameIds).toEqual([]);
    });

    it("only removes frames of the project it's asked about", async () => {
      const other = createProject();
      await repository.createProject(other);
      const theirs = await capture(other.id);
      const { removed } = await repository.removeFrames(project.id, [theirs.frame.id]);
      expect(removed).toEqual([]);
      expect((await repository.loadProject(other.id))?.frames).toHaveLength(1);
    });

    // Collects what a watcher reports, and waits until a condition on it holds.
    const watch = (id: string) => {
      const seen: (Awaited<ReturnType<ProjectRepository["loadProject"]>>)[] = [];
      const stop = repository.watchProject(id, (loaded) => seen.push(loaded));
      const until = async (check: (latest: (typeof seen)[number]) => boolean) => {
        for (let i = 0; i < 100; i++) {
          if (seen.length && check(seen.at(-1))) return seen.at(-1);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw new Error(`watchProject never reported the expected state (saw ${seen.length} updates)`);
      };
      return { seen, stop, until };
    };

    it("watches a project: reports it now, then after every change", async () => {
      const watcher = watch(project.id);
      await watcher.until((latest) => latest?.project.frameIds.length === 0);

      const { frame } = await capture(project.id);
      const latest = await watcher.until((value) => value?.project.frameIds.length === 1);
      expect(latest?.frames.map((f) => f.id)).toEqual([frame.id]);

      await repository.updateProject(project.id, { name: "Renamed" });
      await watcher.until((value) => value?.project.name === "Renamed");
      watcher.stop();
    });

    it("reports undefined for a missing or deleted project", async () => {
      const missing = watch("missing");
      await missing.until((latest) => latest === undefined);
      missing.stop();

      const watcher = watch(project.id);
      await watcher.until((latest) => latest !== undefined);
      await repository.deleteProject(project.id);
      await watcher.until((latest) => latest === undefined);
      watcher.stop();
    });

    it("stops reporting after stop()", async () => {
      const watcher = watch(project.id);
      await watcher.until((latest) => latest !== undefined);
      watcher.stop();
      const count = watcher.seen.length;
      await capture(project.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(watcher.seen.length).toBe(count);
    });

    it("watches the project list: newest first, after creates, changes and deletes", async () => {
      const lists: string[][] = [];
      const stop = repository.watchProjects((projects) => lists.push(projects.map((p) => p.name)));
      const until = async (expected: string[]) => {
        for (let i = 0; i < 100 && JSON.stringify(lists.at(-1)) !== JSON.stringify(expected); i++) await new Promise((resolve) => setTimeout(resolve, 10));
        expect(lists.at(-1)).toEqual(expected);
      };

      await until(["Dino walk"]);
      tick(10);
      const robot = createProject({ name: "Robot dance", now: 5 });
      await repository.createProject(robot);
      await until(["Robot dance", "Dino walk"]);
      await repository.updateProject(project.id, { name: "Dino run" });   // updatedAt 10: now the newest
      await until(["Dino run", "Robot dance"]);
      await repository.deleteProject(robot.id);
      await until(["Dino run"]);
      stop();
    });

    it("gives the first picture's thumbnail as the cover, and none for an empty project", async () => {
      expect(await repository.getCover(project.id)).toBeUndefined();
      expect(await repository.getCover("missing")).toBeUndefined();

      const first = await capture(project.id);
      const second = await capture(project.id, 0);   // inserted at the start: it becomes the cover
      const cover = await repository.getCover(project.id);
      expect(cover?.imageId).toBe(second.frame.imageId);
      expect(await cover?.blob.text()).toBe("thumb");
      expect(cover?.imageId).not.toBe(first.frame.imageId);
    });

    it("deletes a project with all its frames, pictures and thumbnails, and nothing else", async () => {
      const mine = await capture(project.id);
      const other = createProject();
      await repository.createProject(other);
      const theirs = await capture(other.id);

      await repository.deleteProject(project.id);

      expect(await repository.getProject(project.id)).toBeUndefined();
      expect(await repository.loadProject(project.id)).toBeUndefined();
      expect(await repository.getImage(mine.frame.imageId)).toBeUndefined();
      expect(await repository.listThumbs(project.id)).toEqual([]);
      expect((await repository.loadProject(other.id))?.frames.map((f) => f.id)).toEqual([theirs.frame.id]);
      expect(await repository.getImage(theirs.frame.imageId)).toBeDefined();
    });

    describe("importProject (step 27)", () => {
      const animation = () => {
        const restored = createProject({ name: "Restored", now: 0 });
        const a = picture(restored.id);
        const b = picture(restored.id);
        const copy = createFrame(restored.id, a.frame.imageId);
        restored.frameIds = [b.frame.id, a.frame.id, copy.id];
        return { project: restored, frames: [a.frame, b.frame, copy], images: [a.image, b.image], thumbs: [a.thumb, b.thumb] };
      };

      it("saves the whole animation: the project, its frames in order, pictures and thumbnails", async () => {
        const restored = animation();
        await repository.importProject(restored);
        const loaded = await repository.loadProject(restored.project.id);
        expect(loaded?.project.frameIds).toEqual(restored.project.frameIds);
        expect(loaded?.frames.map((frame) => frame.id).sort()).toEqual(restored.frames.map((frame) => frame.id).sort());
        expect(await repository.getImage(restored.images[0].id)).toBeDefined();
        expect(await repository.listThumbs(restored.project.id)).toHaveLength(2);
        expect((await repository.listProjects()).map((p) => p.id)).toContain(restored.project.id);
      });

      it("saves nothing when a frame's picture is missing, or the project exists already", async () => {
        const broken = animation();
        broken.images = [broken.images[0]];   // the second picture isn't there
        await expect(repository.importProject(broken)).rejects.toThrow();
        expect(await repository.getProject(broken.project.id)).toBeUndefined();
        expect(await repository.getImage(broken.images[0].id)).toBeUndefined();

        const again = animation();
        again.project = { ...again.project, id: project.id };   // the one made in beforeEach
        again.frames = again.frames.map((frame) => ({ ...frame, projectId: project.id }));
        again.images = again.images.map((image) => ({ ...image, projectId: project.id }));
        again.thumbs = again.thumbs.map((thumb) => ({ ...thumb, projectId: project.id }));
        await expect(repository.importProject(again)).rejects.toThrow();
        expect((await repository.getProject(project.id))?.name).toBe("Dino walk");   // untouched
        expect(await repository.getImage(again.images[0].id)).toBeUndefined();
      });
    });

    describe("removeUnusedImages (step 21)", () => {
      it("deletes the pictures and thumbnails no frame uses, and keeps the rest", async () => {
        const kept = await capture(project.id);
        const gone = await capture(project.id);
        await repository.removeFrames(project.id, [gone.frame.id]);
        expect(await repository.getImage(gone.frame.imageId)).toBeDefined();   // kept for undo until now

        expect(await repository.removeUnusedImages(project.id)).toBe(1);
        expect(await repository.getImage(gone.frame.imageId)).toBeUndefined();
        expect(await repository.getThumb(gone.frame.imageId)).toBeUndefined();
        expect(await repository.getImage(kept.frame.imageId)).toBeDefined();
        expect(await repository.getThumb(kept.frame.imageId)).toBeDefined();
        expect(await repository.removeUnusedImages(project.id)).toBe(0);   // nothing left to remove
      });

      it("never deletes a picture a duplicate still uses", async () => {
        const original = await capture(project.id);
        const copy = createFrame(project.id, original.frame.imageId);
        await repository.insertFrames(project.id, { frames: [copy] });
        await repository.removeFrames(project.id, [original.frame.id]);

        expect(await repository.removeUnusedImages(project.id)).toBe(0);
        expect(await repository.getImage(original.frame.imageId)).toBeDefined();
      });

      it("only touches its own project", async () => {
        const other = createProject({ name: "Robot dance", now: 0 });
        await repository.createProject(other);
        const theirs = await capture(other.id);
        await repository.removeFrames(other.id, [theirs.frame.id]);

        expect(await repository.removeUnusedImages(project.id)).toBe(0);
        expect(await repository.getImage(theirs.frame.imageId)).toBeDefined();
      });
    });

    it("tells how many bytes each project's pictures take (step 21)", async () => {
      const other = createProject({ name: "Robot dance", now: 0 });
      await repository.createProject(other);
      await capture(project.id);
      await capture(project.id);
      await capture(other.id);
      const one = new Blob(["jpeg"]).size + new Blob(["thumb"]).size;   // what capture() stores
      expect(await repository.projectSizes()).toEqual({ [project.id]: 2 * one, [other.id]: one });
    });
  });
}
