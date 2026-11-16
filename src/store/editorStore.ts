import { createStore } from "zustand/vanilla";
import { clampHold, clampSafeMargin, safeMargin, sameTransform, type Frame, type Project, type Transform } from "@/core/model";
import { clampView, FIT_VIEW, type StageView } from "@/core/render";

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
};

export type SelectionSlice = {
  selection: readonly string[];              // selected frame ids
  select: (ids: readonly string[]) => void;
  clearSelection: () => void;
};

export type PlaybackSlice = {
  isPlaying: boolean;
  playhead: number;                          // ticks from the start (PLAN.md §3)
  loop: boolean;                             // start again at the end; kept when another project opens
  play: () => void;
  pause: () => void;
  seek: (tick: number) => void;
  setLoop: (loop: boolean) => void;
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
  // The same for moving, sizing and turning pictures on the stage (step 18).
  transformPreview: Readonly<Record<string, Transform>>;
  previewTransforms: (transforms: Readonly<Record<string, Transform>>) => void;
  clearTransformPreview: (ids?: readonly string[]) => void;
  // See-through: the picture(s) before the next shot drawn faintly over the live camera.
  onionSkin: OnionSkin;
  setOnionSkin: (changes: Partial<OnionSkin>) => void;
  // The safe zone while its slider is being dragged (the stage shows it); null otherwise. It goes
  // once the saved project has that margin (syncProject), or is cleared.
  safeMarginPreview: number | null;
  previewSafeMargin: (margin: number | null) => void;
  // The side panel's open tab (its id). It also says which tools the stage shows: a tab's stage
  // tools (moving a picture for "picture") only work while it's open. null: the first tab.
  panelTab: string | null;
  setPanelTab: (id: string | null) => void;
  // How closely the stage is looked at (step 19): only the view, never the picture. Back to fit
  // when another animation opens (remembered.ts restores each animation's own).
  stageView: StageView;
  setStageView: (view: Partial<StageView>) => void;
};

// outline: the ghost as broad black-and-white shapes instead of a faint photo.
// difference (step 19): "spot the difference": what lines up goes black, what doesn't glows.
// One look at a time: outline and difference are never both on.
export type OnionSkin = { on: boolean; opacity: number; count: number; outline: boolean; difference: boolean };

export type EditorState = ProjectSlice & SelectionSlice & PlaybackSlice & UiSlice;

export const MIN_TIMELINE_ZOOM = 40;
export const MAX_TIMELINE_ZOOM = 640;
export const DEFAULT_TIMELINE_ZOOM = 160;   // a tick at the default 8 fps is 20 px wide
export const DEFAULT_ONION_SKIN: OnionSkin = { on: true, opacity: 0.4, count: 1, outline: false, difference: false };

const EMPTY = { project: null, frames: {}, selection: [], isPlaying: false, playhead: 0, holdPreview: {}, transformPreview: {}, stageView: FIT_VIEW } as const;

// A factory, so every test (and, if ever needed, a second studio) gets its own store.
export function createEditorStore() {
  return createStore<EditorState>()((set, get) => ({
    ...EMPTY,
    timelineZoom: DEFAULT_TIMELINE_ZOOM,
    loop: true,
    onionSkin: DEFAULT_ONION_SKIN,
    panelTab: null,
    safeMarginPreview: null,

    loadProject: (project, frames) => set({ ...EMPTY, project, frames: byId(frames) }),

    syncProject: (project, frames) => {
      const state = get();
      if (state.project?.id !== project.id) return state.loadProject(project, frames);
      const next = byId(frames);
      const holdPreview = Object.fromEntries(Object.entries(state.holdPreview).filter(([id, hold]) => id in next && next[id].hold !== hold));
      const transformPreview = Object.fromEntries(Object.entries(state.transformPreview).filter(([id, transform]) => id in next && !sameTransform(next[id].transform, transform)));
      const safeMarginPreview = state.safeMarginPreview !== null && safeMargin(project) !== state.safeMarginPreview ? state.safeMarginPreview : null;
      set({ project, frames: next, selection: state.selection.filter((id) => id in next), holdPreview, transformPreview, safeMarginPreview });
    },

    unloadProject: () => set(EMPTY),

    select: (ids) => {
      const { frames } = get();
      set({ selection: [...new Set(ids)].filter((id) => id in frames) });
    },

    clearSelection: () => set({ selection: [] }),

    play: () => { if (get().project?.frameIds.length) set({ isPlaying: true }); },

    pause: () => set({ isPlaying: false }),

    seek: (tick) => set({ playhead: Number.isFinite(tick) ? Math.max(0, Math.round(tick)) : 0 }),

    setLoop: (loop) => set({ loop }),

    // Strength 10-90% (never invisible, never hiding the camera), 1 to 3 pictures back.
    setOnionSkin: (changes) => {
      const next = { ...get().onionSkin, ...changes };
      const difference = Boolean(next.difference) && !changes.outline;   // turning one look on turns the other off
      set({ onionSkin: { on: Boolean(next.on), outline: Boolean(next.outline) && !difference, difference, opacity: clamp(next.opacity, 0.1, 0.9, 0.4), count: Math.round(clamp(next.count, 1, 3, 1)) } });
    },

    setPanelTab: (id) => set({ panelTab: id || null }),

    setStageView: (view) => set({ stageView: clampView({ ...get().stageView, ...view }) }),

    previewSafeMargin: (margin) => set({ safeMarginPreview: margin === null ? null : clampSafeMargin(margin) }),

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

    previewTransforms: (transforms) => {
      const { frames, transformPreview } = get();
      const known = Object.entries(transforms).filter(([id]) => id in frames).map(([id, transform]) => [id, { ...transform }]);
      set({ transformPreview: { ...transformPreview, ...Object.fromEntries(known) } });
    },

    clearTransformPreview: (ids) => {
      if (!ids) return set({ transformPreview: {} });
      const drop = new Set(ids);
      set({ transformPreview: Object.fromEntries(Object.entries(get().transformPreview).filter(([id]) => !drop.has(id))) });
    },
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;

// The frames in animation order. Ids without a frame are skipped, the same way loading repairs
// drift between frameIds and the frames table (step 07).
export function orderedFrames(state: Pick<EditorState, "project" | "frames">): Frame[] {
  return (state.project?.frameIds ?? []).flatMap((id) => state.frames[id] ?? []);
}

// The frames as they should look right now: any length being resized shown at its new
// length. A plain function, applied while rendering (a selector making new objects every
// call would re-render forever). Frames without a preview are returned as they are.
export function withHoldPreview(frames: readonly Frame[], holdPreview: Readonly<Record<string, number>>): Frame[] {
  return frames.map((frame) => (frame.id in holdPreview ? { ...frame, hold: holdPreview[frame.id] } : frame));
}

// The same for transforms: pictures being moved shown where they're being moved to.
export function withTransformPreview(frames: readonly Frame[], transformPreview: Readonly<Record<string, Transform>>): Frame[] {
  return frames.map((frame) => (frame.id in transformPreview ? { ...frame, transform: transformPreview[frame.id] } : frame));
}

function byId(frames: Frame[]): Record<string, Frame> {
  return Object.fromEntries(frames.map((frame) => [frame.id, frame]));
}



function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
