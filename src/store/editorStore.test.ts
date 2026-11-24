import { beforeEach, describe, expect, it } from "vitest";
import { createBubble, createFrame, createOverlay, createProject, createSoundClip, createText, frameIndexAt, moveSoundClip, withProps, type Frame, type Project } from "@/core/model";
import { createEditorStore, MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, orderedFrames, selectedOverlayId, withPreview, type EditorStore } from "@/store/editorStore";

let store: EditorStore;
let project: Project;
let a: Frame, b: Frame, c: Frame;

beforeEach(() => {
  store = createEditorStore();
  project = createProject({ now: 0 });
  [a, b, c] = ["i1", "i2", "i3"].map((imageId) => createFrame(project.id, imageId));
});

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

  it("syncing the same project keeps the selection (minus gone frames) and the playhead", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);
    store.getState().select([a.id, b.id]);
    store.getState().seek(3);
    store.getState().syncProject({ ...project, frameIds: [b.id, c.id] }, [b, c]);
    expect(store.getState()).toMatchObject({ selection: [b.id], playhead: 3 });
    expect(orderedFrames(store.getState())).toEqual([b, c]);
  });

  // Step 31: every save comes back from storage as new objects; keeping the ones that didn't change
  // means only the pictures that changed redraw on the timeline, not all of them.
  it("syncing keeps the frames that didn't change, and takes the ones that did", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);
    const longerB = { ...structuredClone(b), hold: b.hold + 1 };
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [structuredClone(a), longerB]);
    expect(store.getState().frames[a.id]).toBe(a);
    expect(store.getState().frames[b.id]).toBe(longerB);
  });

  it("syncing a different project loads it fresh", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id] }, [a]);
    store.getState().select([a.id]);
    const other = createProject();
    store.getState().syncProject(other, []);
    expect(store.getState()).toMatchObject({ project: other, selection: [], playhead: 0 });
  });

  it("skips ids that have no frame when listing in order", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, "missing", b.id] }, [a, b]);
    expect(orderedFrames(store.getState())).toEqual([a, b]);
  });

  // Step 31: every component that draws pictures reads this list on every change (a selection, the
  // playhead); with hundreds of pictures, building and comparing it each time was what slowed the
  // studio down. The same list back means nothing to compare.
  it("lists the same frames as the very same list until the frames or their order change", () => {
    store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);
    const first = orderedFrames(store.getState());
    store.getState().select([b.id]);
    store.getState().seek(1);
    expect(orderedFrames(store.getState())).toBe(first);

    store.getState().syncProject({ ...project, frameIds: [b.id, a.id] }, [a, b]);
    const reordered = orderedFrames(store.getState());
    expect(reordered).not.toBe(first);
    expect(reordered).toEqual([b, a]);
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

  it("loops by default, and keeps the choice when another project opens", () => {
    expect(store.getState().loop).toBe(true);
    store.getState().setLoop(false);
    store.getState().loadProject(createProject(), []);
    expect(store.getState().loop).toBe(false);
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

  it("zooms the timeline in up to 16 times the usual 160 px a second", () => {
    store.getState().setTimelineZoom(2560);
    expect(store.getState().timelineZoom).toBe(2560);
    store.getState().setTimelineZoom(2561);
    expect(store.getState().timelineZoom).toBe(2560);
  });

  it("survives loading another project (it's about the screen, not the animation)", () => {
    store.getState().setTimelineZoom(200);
    store.getState().loadProject(project, []);
    expect(store.getState().timelineZoom).toBe(200);
  });
});

describe("safe zone preview", () => {
  it("shows the dragged margin (kept to 0-60) until the saved project has it", () => {
    store.getState().loadProject(project, []);
    store.getState().previewSafeMargin(90);
    expect(store.getState().safeMarginPreview).toBe(60);
    store.getState().syncProject({ ...project, safeMargin: 30 }, []);   // not saved yet: still shown
    expect(store.getState().safeMarginPreview).toBe(60);
    store.getState().syncProject({ ...project, safeMargin: 60 }, []);
    expect(store.getState().safeMarginPreview).toBeNull();
  });
});

describe("picked sound (step 29b)", () => {
  it("keeps the pick while the animation has that sound (one just added counts once it's saved), and lets go when it's deleted or another animation opens", () => {
    const boing = createSoundClip("cartoon/boing", 2);
    const project = { ...createProject(), sounds: [boing] };
    store.getState().loadProject({ ...project, sounds: [] }, []);
    store.getState().pickSound(boing.id);                 // added, not saved yet
    store.getState().syncProject(project, []);             // the save comes back
    expect(store.getState().pickedSound).toBe(boing.id);
    store.getState().pickSound("nope");
    store.getState().syncProject(project, []);
    expect(store.getState().pickedSound).toBeNull();      // not a sound it has
    store.getState().pickSound(boing.id);
    expect(store.getState().pickedSound).toBe(boing.id);
    store.getState().syncProject({ ...project, sounds: [moveSoundClip(boing, 1)] }, []);
    expect(store.getState().pickedSound).toBe(boing.id);   // moved, still there
    store.getState().syncProject({ ...project, sounds: [] }, []);
    expect(store.getState().pickedSound).toBeNull();
    store.getState().syncProject(project, []);
    store.getState().pickSound(boing.id);
    store.getState().loadProject(createProject(), []);
    expect(store.getState().pickedSound).toBeNull();
  });
});

describe("panel tab", () => {
  it("starts on the first tab, changes, and stays when another project opens", () => {
    expect(store.getState().panelTab).toBeNull();
    store.getState().setPanelTab("picture");
    store.getState().loadProject(createProject(), []);
    expect(store.getState().panelTab).toBe("picture");
    store.getState().setPanelTab("");
    expect(store.getState().panelTab).toBeNull();
  });
});

describe("onion skin", () => {
  it("is off by default, at 40% and one picture back once it's on", () => {
    expect(store.getState().onionSkin).toEqual({ on: false, opacity: 0.4, count: 1, outline: false, difference: false });
  });

  it("changes, kept to sensible limits", () => {
    store.getState().setOnionSkin({ on: true });
    expect(store.getState().onionSkin.on).toBe(true);
    store.getState().setOnionSkin({ opacity: 2, count: 9 });
    expect(store.getState().onionSkin).toMatchObject({ opacity: 0.9, count: 3 });
    store.getState().setOnionSkin({ opacity: 0, count: 0.2 });
    expect(store.getState().onionSkin).toMatchObject({ opacity: 0.1, count: 1 });
    store.getState().setOnionSkin({ outline: true });
    expect(store.getState().onionSkin.outline).toBe(true);
    store.getState().setOnionSkin({ difference: true });   // one look at a time
    expect(store.getState().onionSkin).toMatchObject({ outline: false, difference: true });
    store.getState().setOnionSkin({ outline: true });
    expect(store.getState().onionSkin).toMatchObject({ outline: true, difference: false });
    store.getState().setOnionSkin({ outline: true, difference: true });   // a stored mix: outline wins
    expect(store.getState().onionSkin).toMatchObject({ outline: true, difference: false });
    store.getState().setOnionSkin({ opacity: Number.NaN });
    expect(store.getState().onionSkin.opacity).toBe(0.4);
  });
});


describe("objects (step 23)", () => {
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("previews a picture's bubbles until the saved ones match", () => {
    const bubble = createBubble("speech", "Hi");
    store.getState().previewElements({ [a.id]: [bubble] });
    expect(withPreview(orderedFrames(store.getState()), "elements", store.getState().elementsPreview)[0].elements).toEqual([bubble]);
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [{ ...a, elements: [withProps(bubble, {})] }, b]);
    expect(store.getState().elementsPreview).toEqual({});
  });

  it("remembers the picked object until another animation opens", () => {
    store.getState().selectElement("y");
    expect(store.getState().selectedElement).toBe("y");
    store.getState().loadProject({ ...project, frameIds: [] }, []);
    expect(store.getState().selectedElement).toBeNull();
  });
});

describe("storage notice", () => {
  it("shows full or almost full until closed; almost full never hides full", () => {
    expect(store.getState().storageNotice).toBeNull();
    store.getState().setStorageNotice("full");
    store.getState().setStorageNotice("almost-full");
    expect(store.getState().storageNotice).toBe("full");
    store.getState().setStorageNotice(null);
    store.getState().setStorageNotice("almost-full");
    expect(store.getState().storageNotice).toBe("almost-full");
  });
});

describe("brightness and contrast preview", () => {
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("shows new values without saving them, kept to 50-150%; dropped once saved, or on clear", () => {
    store.getState().previewAdjusts({ [a.id]: { brightness: 3, contrast: 1.2 }, unknown: { brightness: 1.2, contrast: 1 } });
    expect(store.getState().adjustPreview).toEqual({ [a.id]: { brightness: 1.5, contrast: 1.2 } });
    const shown = withPreview(orderedFrames(store.getState()), "adjust", store.getState().adjustPreview);
    expect(shown[0].adjust).toEqual({ brightness: 1.5, contrast: 1.2 });
    expect(shown[1]).toBe(b);

    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [{ ...a, adjust: { brightness: 1.5, contrast: 1.2 } }, b]);
    expect(store.getState().adjustPreview).toEqual({});
    store.getState().previewAdjusts({ [b.id]: { brightness: 0.8, contrast: 1 } });
    store.getState().clearAdjustPreview([b.id]);
    expect(store.getState().adjustPreview).toEqual({});
  });
});

describe("transform preview", () => {
  const moved = { x: 0.2, y: 0, scale: 2, rotation: 10, flipX: false, flipY: false };
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("shows pictures where they're being moved to, without touching the frames", () => {
    store.getState().previewTransforms({ [a.id]: moved, nope: moved });
    expect(Object.keys(store.getState().transformPreview)).toEqual([a.id]);
    expect(store.getState().frames[a.id].transform).toEqual(a.transform);
    const shown = withPreview(orderedFrames(store.getState()), "transform", store.getState().transformPreview);
    expect(shown[0].transform).toEqual(moved);
    expect(shown[1]).toBe(b);   // untouched frames stay the same objects
  });

  it("drops an entry once the saved frame is there, and on clear", () => {
    store.getState().previewTransforms({ [a.id]: moved, [b.id]: moved });
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [{ ...a, transform: { ...moved } }, b]);
    expect(Object.keys(store.getState().transformPreview)).toEqual([b.id]);
    store.getState().clearTransformPreview();
    expect(store.getState().transformPreview).toEqual({});
  });
});

describe("hold preview", () => {
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("shows new lengths without touching the frames, and only for known frames", () => {
    store.getState().previewHolds({ [a.id]: 4, nope: 2, [b.id]: 0 });
    expect(store.getState().holdPreview).toEqual({ [a.id]: 4, [b.id]: 1 });   // at least 1 tick
    expect(store.getState().frames[a.id].hold).toBe(1);
    const shown = withPreview(orderedFrames(store.getState()), "hold", store.getState().holdPreview);
    expect(shown.map((frame) => frame.hold)).toEqual([4, 1]);
  });

  it("drops an entry once the saved frame has that length", () => {
    store.getState().previewHolds({ [a.id]: 4, [b.id]: 3 });
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [{ ...a, hold: 4 }, b]);
    expect(store.getState().holdPreview).toEqual({ [b.id]: 3 });   // b isn't saved yet: still shown
  });

  it("drops entries of deleted frames, and everything when another project loads", () => {
    store.getState().previewHolds({ [a.id]: 4, [b.id]: 3 });
    store.getState().syncProject({ ...project, frameIds: [a.id] }, [a]);
    expect(store.getState().holdPreview).toEqual({ [a.id]: 4 });
    store.getState().loadProject(createProject(), []);
    expect(store.getState().holdPreview).toEqual({});
  });

  it("clears some entries or all of them", () => {
    store.getState().previewHolds({ [a.id]: 4, [b.id]: 3 });
    store.getState().clearHoldPreview([a.id]);
    expect(store.getState().holdPreview).toEqual({ [b.id]: 3 });
    store.getState().clearHoldPreview();
    expect(store.getState().holdPreview).toEqual({});
  });

  it("leaves frames without a preview as the very same objects", () => {
    const frames = orderedFrames(store.getState());
    expect(withPreview(frames, "hold", {})[0]).toBe(frames[0]);
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
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);   // the project itself
    expect(calls).toBe(1);
  });
});

describe("overlays (step 24)", () => {
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id] }, [a, b]));

  it("previews the overlay list until the saved project has it, and opening another animation drops it", () => {
    const overlay = createOverlay(createText("Hi"), 0, 8);
    store.getState().previewOverlays([overlay]);
    expect(store.getState().overlaysPreview).toEqual([overlay]);
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id] }, [a, b]);   // saved without it yet
    expect(store.getState().overlaysPreview).toEqual([overlay]);
    store.getState().syncProject({ ...project, frameIds: [a.id, b.id], overlays: [overlay] }, [a, b]);
    expect(store.getState().overlaysPreview).toBeNull();

    store.getState().previewOverlays([]);
    store.getState().loadProject(createProject(), []);
    expect(store.getState().overlaysPreview).toBeNull();
  });
});

describe("the timeline selection: pictures or an overlay, never both (step 24)", () => {
  const overlay = { ...createOverlay(createText("Hi"), 1, 4), id: "title" };
  beforeEach(() => store.getState().loadProject({ ...project, frameIds: [a.id, b.id], overlays: [overlay] }, [a, b]));

  it("picking a bar picks its object and, for the stage, the picture where it starts", () => {
    store.getState().select([a.id]);
    store.getState().selectOverlay("title");
    const state = store.getState();
    expect(selectedOverlayId(state)).toBe("title");
    expect(state.selectedElement).toBe(overlay.element.id);
    expect(state.selection).toEqual([orderedFrames(state)[frameIndexAt(orderedFrames(state), 1)].id]);
  });

  it("selecting pictures un-picks the bar; a picture's own object stays picked", () => {
    store.getState().selectOverlay("title");
    store.getState().select([a.id, b.id]);
    expect(selectedOverlayId(store.getState())).toBeNull();
    expect(store.getState().selectedElement).toBeNull();

    store.getState().selectElement("an-object-on-a-picture");
    store.getState().select([b.id]);
    expect(store.getState().selectedElement).toBe("an-object-on-a-picture");
    expect(selectedOverlayId(store.getState())).toBeNull();
  });

  it("an overlay that's gone can't be picked", () => {
    store.getState().select([a.id]);
    store.getState().selectOverlay("missing");
    expect(store.getState().selection).toEqual([a.id]);
    expect(selectedOverlayId(store.getState())).toBeNull();
  });
});

describe("the clipboard (step 24b)", () => {
  it("keeps a copy of its own of what was copied, also when another animation opens", () => {
    const bubble = createBubble("speech", "Hi");
    store.getState().setClipboard(bubble);
    expect(store.getState().clipboard).toEqual(bubble);
    expect(store.getState().clipboard?.props).not.toBe(bubble.props);
    store.getState().loadProject(createProject(), []);
    expect(store.getState().clipboard).toEqual(bubble);
    store.getState().setClipboard(null);
    expect(store.getState().clipboard).toBeNull();
  });
});
