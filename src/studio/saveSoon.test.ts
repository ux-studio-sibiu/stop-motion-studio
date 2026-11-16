import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BURST_DELAY, saveNow, saveSoon, settleSoon } from "./saveSoon";

// Saving a burst of edits once it stops: one save per burst, and never a lost or doubled save
// when the child switches to another kind of edit.

beforeEach(() => vi.useFakeTimers());
afterEach(() => { saveNow(); vi.useRealTimers(); });

describe("saveSoon", () => {
  it("saves a burst once, a moment after the last change", () => {
    const save = vi.fn();
    for (let i = 0; i < 5; i++) { saveSoon("transform", "a", save); vi.advanceTimersByTime(BURST_DELAY - 100); }
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves the waiting burst first when another one starts", () => {
    const first = vi.fn();
    const second = vi.fn();
    saveSoon("transform", "a", first);
    saveSoon("adjust", "a", second);
    expect(first).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BURST_DELAY);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("settling drops a waiting burst of the same kind, and saves one of another kind", () => {
    const same = vi.fn();
    saveSoon("adjust", "a", same);
    settleSoon("adjust");   // that edit is saved straight away instead
    vi.advanceTimersByTime(BURST_DELAY);
    expect(same).not.toHaveBeenCalled();

    const other = vi.fn();
    saveSoon("transform", "a", other);
    settleSoon("adjust");
    expect(other).toHaveBeenCalledTimes(1);
  });
});
