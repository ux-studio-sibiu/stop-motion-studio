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
  // A whole animation at once (restoring a backup, step 27): the project, its frames, pictures and
  // thumbnails, all saved or, if anything is wrong, none. Fails if the project exists already, or a
  // frame belongs to another project or shows a picture that isn't given.
  importProject(animation: ImportedProject): Promise<void>;

  // New frames at `at` in the order (default: the end), with any new pictures they bring.
  // Duplicates share an existing picture, so `images` / `thumbs` may be empty.
  insertFrames(projectId: string, insert: FrameInsert): Promise<Project>;
  // Takes frames out of the animation and says what they were and where they stood, so
  // restoreFrames can put them back. Their pictures stay (undo needs them; unused pictures
  // are cleaned up separately). Ids that aren't in the project are ignored.
  removeFrames(projectId: string, frameIds: readonly string[]): Promise<{ project: Project; removed: RemovedFrame[] }>;
  // Changes frames' length, position or look, all in one transaction. Fails, saving nothing,
  // if a frame isn't in this project. Bumps the project's updatedAt.
  updateFrames(projectId: string, changes: readonly FrameChanges[]): Promise<Project>;
  // Puts frames at the given places in the order, in one transaction: removed frames back where
  // they were, or new frames that share existing pictures (duplicates). Each index is where the
  // frame ends up. Their pictures must exist.
  restoreFrames(projectId: string, removed: readonly RemovedFrame[]): Promise<Project>;

  // Deletes the project's pictures and thumbnails that no frame uses any more: what deleting left
  // behind for undo. A picture shared by duplicates stays while any frame uses it. Call it only
  // when no undo history can still need them (adapters/storage/projectSession.ts). Returns how many
  // pictures it removed.
  removeUnusedImages(projectId: string): Promise<number>;
  // How many bytes each project's pictures and thumbnails take, by project id.
  projectSizes(): Promise<Record<string, number>>;

  getImage(imageId: string): Promise<Blob | undefined>;
  getThumb(imageId: string): Promise<Blob | undefined>;
  listThumbs(projectId: string): Promise<StoredThumb[]>;
}

export type LoadedProject = { project: Project; frames: Frame[] };

export type ImportedProject = { project: Project; frames: Frame[]; images: StoredImage[]; thumbs: StoredThumb[] };

export type ProjectChanges = Partial<Pick<Project, "name" | "fps" | "frameIds" | "safeMargin" | "overlays">>;

// What can change on a frame after it's made. The id says which frame.
export type FrameChanges = { id: string } & Partial<Pick<Frame, "hold" | "transform" | "adjust" | "elements">>;

// A frame taken out of the order, and the index it had there.
export type RemovedFrame = { frame: Frame; index: number };

export type FrameInsert = {
  frames: Frame[];
  images?: StoredImage[];
  thumbs?: StoredThumb[];
  at?: number;
  // Right after this frame instead (looked up inside the transaction, so it works even if the
  // caller's copy of the order is out of date). Wins over `at`; a missing frame means the end.
  after?: string;
};
