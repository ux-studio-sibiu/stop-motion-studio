import { liveQuery } from "dexie";
import type { FrameInsert, Project, ProjectChanges, ProjectRepository } from "@/core/model";
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

    insertFrames: (projectId, { frames, images = [], thumbs = [], at }: FrameInsert) => db.transaction("rw", all, async () => {
      const project = await requireProject(projectId);
      if (frames.some((frame) => frame.projectId !== projectId)) throw new Error("A frame belongs to another project.");

      const index = Math.min(project.frameIds.length, Math.max(0, Math.round(at ?? project.frameIds.length)));
      const frameIds = [...project.frameIds.slice(0, index), ...frames.map((frame) => frame.id), ...project.frameIds.slice(index)];
      const saved = { ...project, frameIds, updatedAt: now() };

      await db.images.bulkPut(images);
      await db.thumbs.bulkPut(thumbs);
      await db.frames.bulkPut(frames);
      await db.projects.put(saved);
      return saved;
    }),

    getImage: async (imageId) => (await db.images.get(imageId))?.blob,

    getThumb: async (imageId) => (await db.thumbs.get(imageId))?.blob,

    listThumbs: (projectId) => db.thumbs.where("projectId").equals(projectId).toArray(),
  };
}
