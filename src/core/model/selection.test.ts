import { describe, expect, it } from "vitest";
import { inOrder, insertIndexAfter, selectRange, toggleInSelection } from "@/core/model";

const order = ["a", "b", "c", "d", "e"];

describe("selectRange", () => {
  it("selects everything between the anchor and the target, either way", () => {
    expect(selectRange(order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectRange(order, "d", "b")).toEqual(["b", "c", "d"]);
    expect(selectRange(order, "c", "c")).toEqual(["c"]);
  });

  it("selects only the target without a usable anchor", () => {
    expect(selectRange(order, undefined, "c")).toEqual(["c"]);
    expect(selectRange(order, "gone", "c")).toEqual(["c"]);
    expect(selectRange(order, "a", "gone")).toEqual([]);
  });
});

describe("toggleInSelection", () => {
  it("adds or removes one picture, keeping timeline order", () => {
    expect(toggleInSelection(order, ["d"], "b")).toEqual(["b", "d"]);
    expect(toggleInSelection(order, ["b", "d"], "b")).toEqual(["d"]);
  });
});

describe("inOrder", () => {
  it("sorts ids into timeline order and drops unknown ones", () => {
    expect(inOrder(order, ["e", "x", "a"])).toEqual(["a", "e"]);
  });
});

describe("insertIndexAfter", () => {
  it("puts the next picture after the rightmost selected one", () => {
    expect(insertIndexAfter(order, ["b"])).toBe(2);
    expect(insertIndexAfter(order, ["d", "a"])).toBe(4);
    expect(insertIndexAfter(order, ["e"])).toBe(5);
  });

  it("puts it at the end with nothing selected", () => {
    expect(insertIndexAfter(order, [])).toBe(5);
    expect(insertIndexAfter([], [])).toBe(0);
  });
});
