import { describe, expect, it } from "vitest";
import { cleanName, createFrame, createProject, DEFAULT_ADJUST, DEFAULT_NAME, MAX_NAME_LENGTH, DEFAULT_TRANSFORM, frameDuration, MAX_HEIGHT, MAX_WIDTH, projectDuration, SCHEMA_VERSION, type Frame } from "@/core/model";

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

describe("durations", () => {
  it("a frame lasts hold ticks of 1/fps", () => {
    expect(frameDuration({ fps: 8 }, { hold: 1 })).toBe(125);
    expect(frameDuration({ fps: 12 }, { hold: 3 })).toBe(250);
  });

  it("changing fps keeps the rhythm: a held frame stays 3x as long", () => {
    const held = { hold: 3 };
    const single = { hold: 1 };
    for (const fps of [5, 8, 15]) {
      expect(frameDuration({ fps }, held)).toBeCloseTo(3 * frameDuration({ fps }, single));
    }
  });

  it("sums the animation in frameIds order and skips missing frames", () => {
    const a = createFrame("p1", "i1");
    const b = createFrame("p1", "i1", { hold: 2 });
    const frames = new Map<string, Frame>([[a.id, a], [b.id, b]]);
    const project = { fps: 10, frameIds: [a.id, b.id, "missing", a.id] };
    expect(projectDuration(project, frames)).toBe(400);
  });
});
