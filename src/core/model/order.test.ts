import { describe, expect, it } from "vitest";
import { repairFrameOrder, sameOrder } from "@/core/model";

const frames = (...ids: string[]) => ids.map((id) => ({ id }));

describe("repairFrameOrder", () => {
  it("leaves a healthy order alone", () => {
    expect(repairFrameOrder(["a", "b", "c"], frames("c", "a", "b"))).toEqual(["a", "b", "c"]);
  });

  it("drops ids that have no frame", () => {
    expect(repairFrameOrder(["a", "ghost", "b"], frames("a", "b"))).toEqual(["a", "b"]);
  });

  it("keeps an id listed twice only at its first place", () => {
    expect(repairFrameOrder(["a", "b", "a"], frames("a", "b"))).toEqual(["a", "b"]);
  });

  it("adds frames missing from the order at the end, never losing a picture", () => {
    expect(repairFrameOrder(["a"], frames("a", "lost-1", "lost-2"))).toEqual(["a", "lost-1", "lost-2"]);
  });

  it("handles an empty project", () => {
    expect(repairFrameOrder([], [])).toEqual([]);
  });
});

describe("sameOrder", () => {
  it("compares ids in order", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});
