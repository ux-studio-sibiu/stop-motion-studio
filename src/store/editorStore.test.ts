import { beforeEach, describe, expect, it } from "vitest";
import { createFrame, createProject, type Frame, type Project } from "@/core/model";
import { createEditorStore, MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, orderedFrames, type EditorStore } from "@/store/editorStore";

let store: EditorStore;
let project: Project;
let a: Frame, b: Frame, c: Frame;

beforeEach(() => {
  store = createEditorStore();
  project = createProject({ now: 0 });
  [a, b, c] = ["i1", "i2", "i3"].map((imageId) => createFrame(project.id, imageId));
});

const ids = () => store.getState().project?.frameIds;

describe("project slice", () => {
  it("starts empty", () => {
    expect(store.getState()).toMatchObject({ project: null, frames: {}, selection: [], isPlaying: false, playhead: 0 });
  });

  it("loads a project and indexes its frames by id", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);
    expect(store.getState().frames[a.id]).toBe(a);
    expect(orderedFrames(store.getState())).toEqual([a, b]);
  });

  it("loading resets selection and playback from the previous project", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id] }, [a]);
    store.getState().select([a.id]);
    store.getState().seek(5);
    store.getState().loadProject(createProject(), []);
    expect(store.getState()).toMatchObject({ selection: [], playhead: 0, isPlaying: false });
  });

  it("inserts at the end by default, or at a position", () => {
    store.getState().loadProject(project, []);
    store.getState().insertFrames([a, b]);
    store.getState().insertFrames([c], 1);
    expect(ids()).toEqual([a.id, c.id, b.id]);
  });

  it("clamps the insert position into the list", () => {
    store.getState().loadProject(project, []);
    store.getState().insertFrames([a]);
    store.getState().insertFrames([b], 99);
    store.getState().insertFrames([c], -3);
    expect(ids()).toEqual([c.id, a.id, b.id]);
  });

  it("replaces state instead of editing it, so the previous state stays intact", () => {
    store.getState().loadProject(project, []);
    const before = store.getState();
    store.getState().insertFrames([a]);
    expect(before.project?.frameIds).toEqual([]);
    expect(before.frames).toEqual({});
    expect(store.getState().project).not.toBe(before.project);
  });

  it("does nothing without a project", () => {
    store.getState().insertFrames([a]);
    expect(store.getState().project).toBeNull();
  });

  it("skips ids that have no frame when listing in order", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, "missing", b.id] }, [a, b]);
    expect(orderedFrames(store.getState())).toEqual([a, b]);
  });
});

describe("selection slice", () => {
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("keeps only known, unique ids", () => {
    store.getState().select([b.id, "nope", b.id, a.id]);
    expect(store.getState().selection).toEqual([b.id, a.id]);
  });

  it("clears", () => {
    store.getState().select([a.id]);
    store.getState().clearSelection();
    expect(store.getState().selection).toEqual([]);
  });

  it("is emptied when the project is unloaded", () => {
    store.getState().select([a.id]);
    store.getState().unloadProject();
    expect(store.getState()).toMatchObject({ project: null, selection: [] });
  });
});

describe("playback slice", () => {
  it("won't play an empty animation", () => {
    store.getState().loadProject(project, []);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(false);
  });

  it("plays and pauses", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id] }, [a]);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(true);
    store.getState().pause();
    expect(store.getState().isPlaying).toBe(false);
  });

  it("seeks to whole, non-negative ticks", () => {
    store.getState().seek(3.6);
    expect(store.getState().playhead).toBe(4);
    store.getState().seek(-2);
    expect(store.getState().playhead).toBe(0);
  });
});

describe("ui slice", () => {
  it("keeps the timeline zoom in range", () => {
    store.getState().setTimelineZoom(1);
    expect(store.getState().timelineZoom).toBe(MIN_TIMELINE_ZOOM);
    store.getState().setTimelineZoom(10_000);
    expect(store.getState().timelineZoom).toBe(MAX_TIMELINE_ZOOM);
  });

  it("survives loading another project (it's about the screen, not the animation)", () => {
    store.getState().setTimelineZoom(200);
    store.getState().loadProject(project, []);
    expect(store.getState().timelineZoom).toBe(200);
  });
});

describe("subscriptions", () => {
  it("notifies a selector only when its piece changes", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id] }, [a]);
    let calls = 0;
    let last = store.getState().project;
    store.subscribe((state) => { if (state.project !== last) { calls++; last = state.project; } });
    store.getState().select([a.id]);   // selection only
    store.getState().seek(2);          // playback only
    expect(calls).toBe(0);
    store.getState().insertFrames([b]);
    expect(calls).toBe(1);
  });
});
