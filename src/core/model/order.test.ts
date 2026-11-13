import { describe, expect, it } from "vitest";
import { gapAt, moveIds, nudgeGap, neighbourAfterDelete, removeFromOrder, repairFrameOrder, restoreToOrder, sameOrder } from "@/core/model";

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

describe("removeFromOrder and restoreToOrder", () => {
  it("removes ids and remembers where they were", () => {
    expect(removeFromOrder(["a", "b", "c", "d"], ["d", "b", "ghost"])).toEqual({ order: ["a", "c"], removed: [{ id: "b", index: 1 }, { id: "d", index: 3 }] });
  });

  it("puts removed ids back exactly where they were", () => {
    const original = ["a", "b", "c", "d", "e"];
    const { order, removed } = removeFromOrder(original, ["a", "c", "e"]);
    expect(restoreToOrder(order, removed)).toEqual(original);
    expect(restoreToOrder(order, [...removed].reverse())).toEqual(original);   // any order of entries
  });

  it("puts ids at the end when the order got shorter meanwhile", () => {
    expect(restoreToOrder(["a"], [{ id: "x", index: 5 }])).toEqual(["a", "x"]);
  });

  it("never adds an id twice", () => {
    expect(restoreToOrder(["a", "b"], [{ id: "b", index: 0 }])).toEqual(["a", "b"]);
  });
});

describe("neighbourAfterDelete", () => {
  it("picks the picture after the deleted ones", () => {
    expect(neighbourAfterDelete(["a", "b", "c", "d"], ["b"])).toBe("c");
    expect(neighbourAfterDelete(["a", "b", "c", "d"], ["b", "c"])).toBe("d");
  });

  it("picks the one before when the deleted ones were at the end", () => {
    expect(neighbourAfterDelete(["a", "b", "c"], ["c"])).toBe("b");
    expect(neighbourAfterDelete(["a", "b", "c"], ["a", "c"])).toBe("b");
  });

  it("picks none when nothing is left or nothing was in the order", () => {
    expect(neighbourAfterDelete(["a"], ["a"])).toBeUndefined();
    expect(neighbourAfterDelete(["a"], ["ghost"])).toBeUndefined();
  });
});

describe("moveIds", () => {
  const order = ["a", "b", "c", "d", "e"];

  it("moves one picture to a gap among the others", () => {
    expect(moveIds(order, ["a"], 2)).toEqual(["b", "c", "a", "d", "e"]);
    expect(moveIds(order, ["e"], 0)).toEqual(["e", "a", "b", "c", "d"]);
    expect(moveIds(order, ["b"], 4)).toEqual(["a", "c", "d", "e", "b"]);
  });

  it("moves a group together, in its own order, closing any holes", () => {
    expect(moveIds(order, ["d", "b"], 0)).toEqual(["b", "d", "a", "c", "e"]);
    expect(moveIds(order, ["a", "c"], 3)).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("clamps the gap and ignores unknown ids", () => {
    expect(moveIds(order, ["a"], 99)).toEqual(["b", "c", "d", "e", "a"]);
    expect(moveIds(order, ["a", "ghost"], -3)).toEqual(order);
  });
});

describe("nudgeGap", () => {
  const order = ["a", "b", "c", "d"];

  it("moves the selection one place left or right", () => {
    expect(moveIds(order, ["b"], nudgeGap(order, ["b"], 1))).toEqual(["a", "c", "b", "d"]);
    expect(moveIds(order, ["b", "c"], nudgeGap(order, ["b", "c"], -1))).toEqual(["b", "c", "a", "d"]);
  });

  it("stays put at the ends", () => {
    expect(moveIds(order, ["a"], nudgeGap(order, ["a"], -1))).toEqual(order);
    expect(moveIds(order, ["d"], nudgeGap(order, ["d"], 1))).toEqual(order);
  });
});

describe("gapAt", () => {
  const slots = [{ start: 0, width: 20 }, { start: 20, width: 60 }, { start: 80, width: 20 }];

  it("counts the pictures whose middle is left of the drop", () => {
    expect(gapAt(slots, -5)).toBe(0);
    expect(gapAt(slots, 11)).toBe(1);
    expect(gapAt(slots, 49)).toBe(1);   // left half of the long picture: before it
    expect(gapAt(slots, 51)).toBe(2);
    expect(gapAt(slots, 500)).toBe(3);
  });
});

describe("sameOrder", () => {
  it("compares ids in order", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});
