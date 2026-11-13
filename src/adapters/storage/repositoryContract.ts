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
  });
}
