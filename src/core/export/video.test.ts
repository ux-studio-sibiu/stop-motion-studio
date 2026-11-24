import { describe, expect, it } from "vitest";
import { exportFileName, exportSegments, uniqueFileNames, videoFrames } from "@/core/export";

const holds = (...values: number[]) => values.map((hold) => ({ hold }));

describe("exportSegments", () => {
  it("cuts only where the screen changes: a new picture, an overlay starting or ending", () => {
    expect(exportSegments(holds(4, 4), [{ id: "title", start: 2, length: 4 }])).toEqual([{ tick: 0, ticks: 2 }, { tick: 2, ticks: 2 }, { tick: 4, ticks: 2 }, { tick: 6, ticks: 2 }]);
    expect(exportSegments(holds(8), [{ id: "all", start: 0, length: 8 }])).toEqual([{ tick: 0, ticks: 8 }]);
    expect(exportSegments([], [])).toEqual([]);
  });
});

describe("videoFrames", () => {
  it("is one video frame per stretch, starting at its time and lasting as long, in seconds", () => {
    expect(videoFrames(holds(1, 8, 3), [], 8)).toEqual([
      { tick: 0, ticks: 1, timestamp: 0, duration: 0.125 },
      { tick: 1, ticks: 8, timestamp: 0.125, duration: 1 },   // held: one frame, a second long
      { tick: 9, ticks: 3, timestamp: 1.125, duration: 0.375 },
    ]);
  });

  it("ends exactly at the animation's length, each frame starting where the one before ends", () => {
    const frames = videoFrames(holds(...Array(15).fill(1)), [], 15);
    const last = frames.at(-1)!;
    expect(last.timestamp + last.duration).toBe(1);
    frames.slice(1).forEach((frame, i) => expect(frame.timestamp).toBeCloseTo(frames[i].timestamp + frames[i].duration, 12));
  });
});

describe("exportFileName", () => {
  it("is the animation's name with the file's extension", () => {
    expect(exportFileName("Dino walk", "mp4")).toBe("Dino walk.mp4");
    expect(exportFileName("a/b", "webm")).toBe("a b.webm");
  });
});

describe("uniqueFileNames", () => {
  it("numbers names already taken, ignoring case, and keeps the order", () => {
    expect(uniqueFileNames(["Dino.zip", "Cat.zip", "dino.zip", "Dino.zip"])).toEqual(["Dino.zip", "Cat.zip", "dino (2).zip", "Dino (3).zip"]);
  });

  it("never makes a name that's already in the list", () => {
    expect(uniqueFileNames(["Dino (2).zip", "Dino.zip", "Dino.zip"])).toEqual(["Dino (2).zip", "Dino.zip", "Dino (3).zip"]);
  });
});
