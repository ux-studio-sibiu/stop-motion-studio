import { describe, expect, it } from "vitest";
import { activeOverlays, overlaysDuring, cloneOverlays, createOverlay, createText, duplicateOverlay, moveOverlay, overlayLanes, overlaysOf, resizeOverlay, sameOverlays, withOverlay, type Overlay } from ".";

const at = (start: number, length: number, id = `o${start}-${length}`): Overlay => ({ ...createOverlay(createText(), start, length), id });

describe("overlays", () => {
  it("start and last whole ticks, never before the start, at least one tick", () => {
    expect(createOverlay(createText(), 3.4, 7.6)).toMatchObject({ track: 1, start: 3, length: 8 });
    expect(createOverlay(createText(), -5, 0)).toMatchObject({ start: 0, length: 1 });
  });

  it("are read defensively: none for older projects, and broken entries left out", () => {
    expect(overlaysOf({})).toEqual([]);
    expect(overlaysOf(null)).toEqual([]);
    const good = at(2, 4);
    expect(overlaysOf({ overlays: [good, { id: 3 }, null, { id: "x", element: "nope" }] as unknown as Overlay[] })).toEqual([good]);
  });

  it("show from their start up to, not including, their end; later starts on top", () => {
    const early = at(0, 10, "early");
    const late = at(4, 2, "late");
    const after = at(20, 4, "after");
    expect(activeOverlays([late, early, after], 0).map((o) => o.id)).toEqual(["early"]);
    expect(activeOverlays([late, early, after], 5).map((o) => o.id)).toEqual(["early", "late"]);
    expect(activeOverlays([late, early, after], 6).map((o) => o.id)).toEqual(["early"]);   // late ended at 6
    expect(activeOverlays([late, early, after], 15)).toEqual([]);
  });

  it("over a span are the ones showing at any moment of it, even partly", () => {
    const early = at(0, 3, "early");    // ticks 0-2
    const inside = at(5, 1, "inside");  // tick 5
    const late = at(7, 4, "late");      // ticks 7-10
    const all = [late, inside, early];
    expect(overlaysDuring(all, 2, 8).map((o) => o.id)).toEqual(["early", "inside", "late"]);   // ends in it, inside it, starts in it
    expect(overlaysDuring(all, 3, 5)).toEqual([]);                                             // early ended at 3, inside starts at 5
    expect(overlaysDuring(all, 4, 6).map((o) => o.id)).toEqual(["inside"]);
  });

  it("move by whole ticks, stopping at the start", () => {
    expect(moveOverlay(at(4, 3), 2.6)).toMatchObject({ start: 7, length: 3 });
    expect(moveOverlay(at(4, 3), -10)).toMatchObject({ start: 0, length: 3 });
  });

  it("resize from either edge: the start edge keeps the end, the end edge keeps the start", () => {
    expect(resizeOverlay(at(4, 6), "end", 3)).toMatchObject({ start: 4, length: 9 });
    expect(resizeOverlay(at(4, 6), "end", -20)).toMatchObject({ start: 4, length: 1 });
    expect(resizeOverlay(at(4, 6), "start", 2)).toMatchObject({ start: 6, length: 4 });
    expect(resizeOverlay(at(4, 6), "start", 20)).toMatchObject({ start: 9, length: 1 });   // its end stays at 10
    expect(resizeOverlay(at(4, 6), "start", -20)).toMatchObject({ start: 0, length: 10 });
  });

  it("are laid out in rows so overlapping ones don't hide each other", () => {
    const lanes = overlayLanes([at(0, 8, "a"), at(4, 8, "b"), at(8, 2, "c"), at(5, 1, "d")]);
    expect(lanes).toEqual({ a: 0, b: 1, d: 2, c: 0 });   // c starts as a ends
  });

  it("are replaced or removed by id, and copied with nothing shared", () => {
    const a = at(0, 2, "a");
    const b = at(3, 2, "b");
    expect(withOverlay([a, b], "a", null)).toEqual([b]);
    expect(withOverlay([a, b], "b", { ...b, start: 9 })[1].start).toBe(9);
    const copy = cloneOverlays([a]);
    expect(sameOverlays(copy, [a])).toBe(true);
    expect(copy[0].element).not.toBe(a.element);
  });

  it("are duplicated to start where the original ends, as the same object with ids of their own", () => {
    const original = at(4, 6, "a");
    const copy = duplicateOverlay(original);
    expect(copy).toMatchObject({ start: 10, length: 6, track: 1 });
    expect(copy.id).not.toBe(original.id);
    expect(copy.element.id).not.toBe(original.element.id);
    expect({ ...copy.element, id: "" }).toEqual({ ...original.element, id: "" });
    expect(copy.element.props).not.toBe(original.element.props);   // nothing shared
  });
});
