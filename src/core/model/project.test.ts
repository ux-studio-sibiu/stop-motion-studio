import { describe, expect, it } from "vitest";
import { createBubble, clampAdjust, clampSafeMargin, cleanName, sameAdjust, cloneFrame, safeMargin, createFrame, createProject, DEFAULT_ADJUST, DEFAULT_NAME, MAX_NAME_LENGTH, DEFAULT_TRANSFORM, MAX_HEIGHT, MAX_WIDTH, SCHEMA_VERSION, type Frame } from "@/core/model";

describe("createProject", () => {
  it("uses the defaults", () => {
    const project = createProject({ now: 1000 });
    expect(project).toMatchObject({ schemaVersion: SCHEMA_VERSION, name: "My animation", width: 1280, height: 720, fps: 8, frameIds: [], createdAt: 1000, updatedAt: 1000 });
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("gives every project its own id", () => {
    expect(createProject().id).not.toBe(createProject().id);
  });

  it("falls back to the default name when the name is blank", () => {
    expect(createProject({ name: "   " }).name).toBe("My animation");
    expect(createProject({ name: "  Dino walk " }).name).toBe("Dino walk");
  });

  it("caps the resolution and keeps it even", () => {
    expect(createProject({ width: 4000, height: 3000 })).toMatchObject({ width: MAX_WIDTH, height: MAX_HEIGHT });
    expect(createProject({ width: 641, height: 481 })).toMatchObject({ width: 640, height: 480 });
  });

  it("clamps the speed to whole fps between 1 and 30", () => {
    expect(createProject({ fps: 0 }).fps).toBe(1);
    expect(createProject({ fps: 60 }).fps).toBe(30);
    expect(createProject({ fps: 11.6 }).fps).toBe(12);
    expect(createProject({ fps: Number.NaN }).fps).toBe(8);
  });
});

describe("cleanName", () => {
  it("tidies spaces inside and around the name", () => {
    expect(cleanName("  Dino   walk\n ")).toBe("Dino walk");
  });

  it("falls back to the default when nothing is left", () => {
    expect(cleanName("   ")).toBe(DEFAULT_NAME);
    expect(cleanName("")).toBe(DEFAULT_NAME);
  });

  it("caps long names without leaving a trailing space", () => {
    const name = cleanName(`${"a".repeat(MAX_NAME_LENGTH - 1)} and more`);
    expect(name).toBe("a".repeat(MAX_NAME_LENGTH - 1));
    expect(cleanName("b".repeat(200))).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("createFrame", () => {
  it("starts unchanged: no move, no flip, no adjustment, one tick", () => {
    const frame = createFrame("p1", "i1");
    expect(frame).toMatchObject({ projectId: "p1", imageId: "i1", hold: 1, transform: DEFAULT_TRANSFORM, adjust: DEFAULT_ADJUST });
  });

  it("merges partial transform and adjust over the defaults", () => {
    const frame = createFrame("p1", "i1", { transform: { x: 0.25, flipX: true }, adjust: { brightness: 1.2 } });
    expect(frame.transform).toEqual({ ...DEFAULT_TRANSFORM, x: 0.25, flipX: true });
    expect(frame.adjust).toEqual({ brightness: 1.2, contrast: 1 });
  });

  it("never shares or mutates the default objects", () => {
    const a = createFrame("p1", "i1");
    const b = createFrame("p1", "i1");
    expect(a.transform).not.toBe(b.transform);
    expect(a.transform).not.toBe(DEFAULT_TRANSFORM);
    expect(Object.isFrozen(DEFAULT_TRANSFORM)).toBe(true);
  });

  it("keeps hold a whole number of at least one tick", () => {
    expect(createFrame("p1", "i1", { hold: 0 }).hold).toBe(1);
    expect(createFrame("p1", "i1", { hold: 2.4 }).hold).toBe(2);
  });
});

describe("empty pictures", () => {
  it("are marked empty, and their copies too; a photo isn't", () => {
    const empty = createFrame("p1", "img-blank", { empty: true });
    expect(empty.empty).toBe(true);
    expect(cloneFrame(empty).empty).toBe(true);
    expect("empty" in createFrame("p1", "img-photo")).toBe(false);
  });
});

describe("cloneFrame", () => {
  const source = createFrame("p1", "img-1", { hold: 3, transform: { x: 0.1, scale: 1.4, rotation: 12, flipX: true }, adjust: { brightness: 1.3 }, elements: [createBubble("speech", "Hi")] });

  it("copies every field except the id", () => {
    const copy = cloneFrame(source);
    expect(copy.id).not.toBe(source.id);
    expect({ ...copy, id: source.id }).toEqual(source);
    expect(Object.keys(copy).sort()).toEqual(Object.keys(source).sort());
  });

  it("shares the picture, not the nested objects", () => {
    const copy = cloneFrame(source);
    expect(copy.imageId).toBe(source.imageId);
    // Any nested object or array shared with the source would let an edit to the copy move the
    // source too. This also catches a future nested field (elements) that isn't copied.
    for (const key of Object.keys(source) as (keyof Frame)[]) {
      if (typeof source[key] === "object" && source[key] !== null) expect(copy[key], key).not.toBe(source[key]);
    }
    copy.transform.x = 0.9;
    expect(source.transform.x).toBe(0.1);
    expect(copy.elements[0].props).not.toBe(source.elements[0].props);   // a copied bubble's text is its own
  });
});

describe("safe zone", () => {
  it("defaults to 20 px for projects that never set it, and stays within 0-60 whole pixels", () => {
    expect(safeMargin({})).toBe(20);
    expect(safeMargin({ safeMargin: 0 })).toBe(0);
    expect(safeMargin({ safeMargin: 33.6 })).toBe(34);
    expect(clampSafeMargin(-5)).toBe(0);
    expect(clampSafeMargin(500)).toBe(60);
    expect(clampSafeMargin(Number.NaN)).toBe(20);
  });
});

describe("clampAdjust and sameAdjust", () => {
  it("keeps brightness and contrast between 50% and 150%, in whole percents", () => {
    expect(clampAdjust({ brightness: 3, contrast: 0.1 })).toEqual({ brightness: 1.5, contrast: 0.5 });
    expect(clampAdjust({ brightness: 1.234, contrast: 0.987 })).toEqual({ brightness: 1.23, contrast: 0.99 });
    expect(clampAdjust({ brightness: Number.NaN })).toEqual(DEFAULT_ADJUST);
  });

  it("tells whether two adjustments are the same", () => {
    expect(sameAdjust(DEFAULT_ADJUST, { brightness: 1, contrast: 1 })).toBe(true);
    expect(sameAdjust(DEFAULT_ADJUST, { brightness: 1.1, contrast: 1 })).toBe(false);
  });
});
