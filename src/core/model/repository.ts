import type { Frame, Project, StoredImage, StoredThumb } from "./types";

// Where projects are kept. The studio only ever talks to this interface, so the storage
// behind it can change (IndexedDB now, a cloud backend later) without touching the editor.
//
// Every method that changes more than one record does it atomically: either all of it is
// saved or none of it, so a crash or a full disk never leaves a frame without its picture.
export interface ProjectRepository {
  // Newest first, by updatedAt.
  listProjects(): Promise<Project[]>;
  // listProjects now, then again after any project is created, changed or deleted.
  watchProjects(onChange: (projects: Project[]) => void, onError?: (error: unknown) => void): () => void;
  // The thumbnail of the project's first picture, for its card; undefined while it has none.
  getCover(projectId: string): Promise<{ imageId: string; blob: Blob } | undefined>;
  getProject(id: string): Promise<Project | undefined>;
  // The project and all its frames (in no particular order: project.frameIds is the order).
  loadProject(id: string): Promise<LoadedProject | undefined>;
  // Calls `onChange` with the project now, then again whenever it or its frames change,
  // from this tab or any other. `undefined` means it doesn't exist (or was deleted).
  // Returns a function that stops watching.
  watchProject(id: string, onChange: (loaded: LoadedProject | undefined) => void, onError?: (error: unknown) => void): () => void;

  createProject(project: Project): Promise<void>;
  // Renames, speed changes, a new order. Bumps updatedAt. Returns the saved project.
  updateProject(id: string, changes: ProjectChanges): Promise<Project>;
  // The project with all its frames, pictures and thumbnails.
  deleteProject(id: string): Promise<void>;

  // New frames at `at` in the order (default: the end), with any new pictures they bring.
  // Duplicates share an existing picture, so `images` / `thumbs` may be empty.
  insertFrames(projectId: string, insert: FrameInsert): Promise<Project>;

  getImage(imageId: string): Promise<Blob | undefined>;
  getThumb(imageId: string): Promise<Blob | undefined>;
  listThumbs(projectId: string): Promise<StoredThumb[]>;
}

export type LoadedProject = { project: Project; frames: Frame[] };

export type ProjectChanges = Partial<Pick<Project, "name" | "fps" | "frameIds">>;

export type FrameInsert = {
  frames: Frame[];
  images?: StoredImage[];
  thumbs?: StoredThumb[];
  at?: number;
};
