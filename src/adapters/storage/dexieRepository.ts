import { liveQuery } from "dexie";
import { removeFromOrder, restoreToOrder, type FrameInsert, type Project, type ProjectChanges, type ProjectRepository, type RemovedFrame } from "@/core/model";
import type { StudioDb } from "./db";

// ProjectRepository on IndexedDB, through Dexie. `now` is injectable so tests control
// updatedAt.
export function createDexieRepository(db: StudioDb, now: () => number = Date.now): ProjectRepository {
  const all = [db.projects, db.frames, db.images, db.thumbs];

  // Read the project inside the running transaction, so nobody can change it in between.
  async function requireProject(id: string): Promise<Project> {
    const project = await db.projects.get(id);
    if (!project) throw new Error(`Project ${id} doesn't exist.`);
    return project;
  }

  return {
    listProjects: () => db.projects.orderBy("updatedAt").reverse().toArray(),

    watchProjects: (onChange, onError) => {
      const subscription = liveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray()).subscribe({ next: onChange, error: onError });
      return () => subscription.unsubscribe();
    },

    getCover: async (projectId) => {
      const firstId = (await db.projects.get(projectId))?.frameIds[0];
      const frame = firstId ? await db.frames.get(firstId) : undefined;
      const thumb = frame ? await db.thumbs.get(frame.imageId) : undefined;
      return thumb ? { imageId: thumb.imageId, blob: thumb.blob } : undefined;
    },

    getProject: (id) => db.projects.get(id),

    loadProject: (id) => db.transaction("r", db.projects, db.frames, async () => {
      const project = await db.projects.get(id);
      if (!project) return undefined;
      const frames = await db.frames.where("projectId").equals(id).toArray();
      return { project, frames };
    }),

    // liveQuery re-runs the query whenever a write touches what it read: the project's row
    // or any frame with this projectId, in this tab or (through BroadcastChannel) another.
    watchProject: (id, onChange, onError) => {
      const subscription = liveQuery(async () => {
        const [project, frames] = await Promise.all([db.projects.get(id), db.frames.where("projectId").equals(id).toArray()]);
        return project ? { project, frames } : undefined;
      }).subscribe({ next: onChange, error: onError });
      return () => subscription.unsubscribe();
    },

    createProject: async (project) => { await db.projects.add(project); },

    updateProject: (id, changes: ProjectChanges) => db.transaction("rw", db.projects, async () => {
      const saved = { ...(await requireProject(id)), ...changes, updatedAt: now() };
      await db.projects.put(saved);
      return saved;
    }),

    deleteProject: (id) => db.transaction("rw", all, async () => {
      await Promise.all([
        db.frames.where("projectId").equals(id).delete(),
        db.images.where("projectId").equals(id).delete(),
        db.thumbs.where("projectId").equals(id).delete(),
        db.projects.delete(id),
      ]);
    }),

    importProject: ({ project, frames, images, thumbs }) => db.transaction("rw", all, async () => {
      const pictures = new Set(images.map((image) => image.id));
      if (frames.some((frame) => frame.projectId !== project.id || !pictures.has(frame.imageId))) throw new Error("A frame belongs to another project, or its picture is missing.");
      if ([...images, ...thumbs].some((item) => item.projectId !== project.id)) throw new Error("A picture belongs to another project.");
      await db.projects.add(project);   // fails if it exists: a restore never overwrites
      await db.images.bulkAdd(images);
      await db.thumbs.bulkAdd(thumbs);
      await db.frames.bulkAdd(frames);
    }),

    insertFrames: (projectId, { frames, images = [], thumbs = [], at, after }: FrameInsert) => db.transaction("rw", all, async () => {
      const project = await requireProject(projectId);
      if (frames.some((frame) => frame.projectId !== projectId)) throw new Error("A frame belongs to another project.");

      const afterIndex = after === undefined ? -1 : project.frameIds.indexOf(after);
      const wanted = after === undefined ? at : afterIndex < 0 ? undefined : afterIndex + 1;
      const index = Math.min(project.frameIds.length, Math.max(0, Math.round(wanted ?? project.frameIds.length)));
      const frameIds = [...project.frameIds.slice(0, index), ...frames.map((frame) => frame.id), ...project.frameIds.slice(index)];
      const saved = { ...project, frameIds, updatedAt: now() };

      await db.images.bulkPut(images);
      await db.thumbs.bulkPut(thumbs);
      await db.frames.bulkPut(frames);
      await db.projects.put(saved);
      return saved;
    }),

    removeFrames: (projectId, frameIds) => db.transaction("rw", db.projects, db.frames, async () => {
      const project = await requireProject(projectId);
      const { order, removed: entries } = removeFromOrder(project.frameIds, frameIds);
      const frames = await db.frames.bulkGet(entries.map((entry) => entry.id));
      const removed: RemovedFrame[] = entries.flatMap(({ index }, i) => {
        const frame = frames[i];
        return frame && frame.projectId === projectId ? [{ frame, index }] : [];
      });
      const saved = { ...project, frameIds: order, updatedAt: now() };
      await db.frames.bulkDelete(removed.map(({ frame }) => frame.id));
      await db.projects.put(saved);
      return { project: saved, removed };
    }),

    updateFrames: (projectId, changes) => db.transaction("rw", db.projects, db.frames, async () => {
      const project = await requireProject(projectId);
      const frames = await db.frames.bulkGet(changes.map((change) => change.id));
      const updated = changes.map((change, i) => {
        const frame = frames[i];
        if (!frame || frame.projectId !== projectId) throw new Error(`Frame ${change.id} isn't in project ${projectId}.`);
        return { ...frame, ...change };
      });
      const saved = { ...project, updatedAt: now() };
      await db.frames.bulkPut(updated);
      await db.projects.put(saved);
      return saved;
    }),

    restoreFrames: (projectId, removed) => db.transaction("rw", db.projects, db.frames, async () => {
      const project = await requireProject(projectId);
      if (removed.some(({ frame }) => frame.projectId !== projectId)) throw new Error("A frame belongs to another project.");
      const saved = { ...project, frameIds: restoreToOrder(project.frameIds, removed.map(({ frame, index }) => ({ id: frame.id, index }))), updatedAt: now() };
      await db.frames.bulkPut(removed.map(({ frame }) => frame));
      await db.projects.put(saved);
      return saved;
    }),

    getImage: async (imageId) => (await db.images.get(imageId))?.blob,

    getThumb: async (imageId) => (await db.thumbs.get(imageId))?.blob,

    listThumbs: (projectId) => db.thumbs.where("projectId").equals(projectId).toArray(),

    removeUnusedImages: (projectId) => db.transaction("rw", db.frames, db.images, db.thumbs, async () => {
      const used = new Set((await db.frames.where("projectId").equals(projectId).toArray()).map((frame) => frame.imageId));
      const images = (await db.images.where("projectId").equals(projectId).primaryKeys()).filter((id) => !used.has(id));
      const thumbs = (await db.thumbs.where("projectId").equals(projectId).primaryKeys()).filter((id) => !used.has(id));
      await db.images.bulkDelete(images);
      await db.thumbs.bulkDelete(thumbs);
      return images.length;
    }),

    projectSizes: () => db.transaction("r", db.images, db.thumbs, async () => {
      const sizes: Record<string, number> = {};
      const add = (projectId: string, blob: Blob | undefined) => { sizes[projectId] = (sizes[projectId] ?? 0) + (blob?.size ?? 0); };
      await db.images.each((image) => add(image.projectId, image.blob));
      await db.thumbs.each((thumb) => add(thumb.projectId, thumb.blob));
      return sizes;
    }),
  };
}
