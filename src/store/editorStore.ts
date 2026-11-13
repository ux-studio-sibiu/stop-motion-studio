import { createStore } from "zustand/vanilla";
import { clampHold, type Frame, type Project } from "@/core/model";

// Live editor state (PLAN.md §1): what the studio is showing and doing right now.
// Metadata only: never Blobs, MediaStreams or DOM nodes. Photos live in the image cache
// (and IndexedDB from step 07); the camera stream lives in useCamera.
//
// Four slices, each a group of fields plus the actions that change them. They're plain
// sections of one store, so one action can update several slices in one step.

export type ProjectSlice = {
  project: Project | null;
  frames: Readonly<Record<string, Frame>>;   // by id; the order is project.frameIds
  loadProject: (project: Project, frames: Frame[]) => void;
  // Mirrors the saved project after a change (from storage, maybe from another tab).
  // The same project keeps its selection (minus deleted frames) and playback; a different
  // one is loaded fresh.
  syncProject: (project: Project, frames: Frame[]) => void;
  unloadProject: () => void;
  insertFrames: (frames: Frame[], at?: number) => void;
};

export type SelectionSlice = {
  selection: readonly string[];              // selected frame ids
  select: (ids: readonly string[]) => void;
  clearSelection: () => void;
};

export type PlaybackSlice = {
  isPlaying: boolean;
  playhead: number;                          // ticks from the start (PLAN.md §3)
  play: () => void;
  pause: () => void;
  seek: (tick: number) => void;
};

export type UiSlice = {
  timelineZoom: number;                      // px per second on the timeline
  setTimelineZoom: (pxPerSecond: number) => void;
  // Lengths shown while a resize is in progress (dragging, or a key press not saved yet), by
  // frame id. Only the screen uses them; the saved frames are unchanged until the command
  // runs. An entry goes once the saved frame has that length (syncProject) or is cleared.
  holdPreview: Readonly<Record<string, number>>;
  previewHolds: (holds: Readonly<Record<string, number>>) => void;
  clearHoldPreview: (ids?: readonly string[]) => void;
};

export type EditorState = ProjectSlice & SelectionSlice & PlaybackSlice & UiSlice;

export const MIN_TIMELINE_ZOOM = 40;
export const MAX_TIMELINE_ZOOM = 640;
export const DEFAULT_TIMELINE_ZOOM = 160;   // a tick at the default 8 fps is 20 px wide

const EMPTY = { project: null, frames: {}, selection: [], isPlaying: false, playhead: 0, holdPreview: {} } as const;

// A factory, so every test (and, if ever needed, a second studio) gets its own store.
export function createEditorStore() {
  return createStore<EditorState>()((set, get) => ({
    ...EMPTY,
    timelineZoom: DEFAULT_TIMELINE_ZOOM,

    loadProject: (project, frames) => set({ ...EMPTY, project, frames: byId(frames) }),

    syncProject: (project, frames) => {
      const state = get();
      if (state.project?.id !== project.id) return state.loadProject(project, frames);
      const next = byId(frames);
      const holdPreview = Object.fromEntries(Object.entries(state.holdPreview).filter(([id, hold]) => id in next && next[id].hold !== hold));
      set({ project, frames: next, selection: state.selection.filter((id) => id in next), holdPreview });
    },

    unloadProject: () => set(EMPTY),

    // Adds frames to the animation at `at` (default: the end). The project and frames
    // objects are replaced, never edited, so the previous state stays intact.
    insertFrames: (frames, at) => {
      const { project } = get();
      if (!project || frames.length === 0) return;
      const index = clampIndex(at ?? project.frameIds.length, project.frameIds.length);
      const frameIds = [...project.frameIds.slice(0, index), ...frames.map((frame) => frame.id), ...project.frameIds.slice(index)];
      set((state) => ({ project: { ...project, frameIds }, frames: { ...state.frames, ...byId(frames) } }));
    },

    select: (ids) => {
      const { frames } = get();
      set({ selection: [...new Set(ids)].filter((id) => id in frames) });
    },

    clearSelection: () => set({ selection: [] }),

    play: () => { if (get().project?.frameIds.length) set({ isPlaying: true }); },

    pause: () => set({ isPlaying: false }),

    seek: (tick) => set({ playhead: Number.isFinite(tick) ? Math.max(0, Math.round(tick)) : 0 }),

    setTimelineZoom: (pxPerSecond) => set({ timelineZoom: Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, pxPerSecond)) }),

    previewHolds: (holds) => {
      const { frames, holdPreview } = get();
      const known = Object.entries(holds).filter(([id]) => id in frames).map(([id, hold]) => [id, clampHold(hold)]);
      set({ holdPreview: { ...holdPreview, ...Object.fromEntries(known) } });
    },

    clearHoldPreview: (ids) => {
      if (!ids) return set({ holdPreview: {} });
      const drop = new Set(ids);
      set({ holdPreview: Object.fromEntries(Object.entries(get().holdPreview).filter(([id]) => !drop.has(id))) });
    },
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;

// The frames in animation order. Ids without a frame are skipped (see projectDuration).
export function orderedFrames(state: Pick<EditorState, "project" | "frames">): Frame[] {
  return (state.project?.frameIds ?? []).flatMap((id) => state.frames[id] ?? []);
}

// The frames as they should look right now: any length being resized shown at its new
// length. A plain function, applied while rendering (a selector making new objects every
// call would re-render forever). Frames without a preview are returned as they are.
export function withHoldPreview(frames: readonly Frame[], holdPreview: Readonly<Record<string, number>>): Frame[] {
  return frames.map((frame) => (frame.id in holdPreview ? { ...frame, hold: holdPreview[frame.id] } : frame));
}

function byId(frames: Frame[]): Record<string, Frame> {
  return Object.fromEntries(frames.map((frame) => [frame.id, frame]));
}

function clampIndex(index: number, length: number): number {
  return Number.isFinite(index) ? Math.min(length, Math.max(0, Math.round(index))) : length;
}
