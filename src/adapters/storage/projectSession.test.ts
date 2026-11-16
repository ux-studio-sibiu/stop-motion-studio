import { describe, expect, it, vi } from "vitest";
import { openProjectSession } from "./projectSession";

// The clean-up only runs when no other tab has the animation open (Node has Web Locks too).

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
let next = 0;
const projectId = () => `project-${next++}`;

describe("openProjectSession", () => {
  it("cleans up when the animation opens and when it's left, if no one else has it open", async () => {
    const cleanUp = vi.fn(async () => {});
    const close = openProjectSession(projectId(), cleanUp);
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(1);
    close();
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(2);
  });

  it("doesn't clean up while another tab has the same animation open", async () => {
    const id = projectId();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    const closeFirst = openProjectSession(id, first);
    await settle();
    const closeSecond = openProjectSession(id, second);
    await settle();
    expect(second).not.toHaveBeenCalled();   // the first tab may still undo a delete

    closeFirst();
    await settle();
    expect(first).toHaveBeenCalledTimes(1);  // only its opening clean-up: the second tab is still there
    closeSecond();
    await settle();
    expect(second).toHaveBeenCalledTimes(1); // the last one out cleans up
  });

  it("another animation open elsewhere doesn't hold it back", async () => {
    const other = vi.fn(async () => {});
    const closeOther = openProjectSession(projectId(), other);
    const cleanUp = vi.fn(async () => {});
    const close = openProjectSession(projectId(), cleanUp);
    await settle();
    expect(cleanUp).toHaveBeenCalledTimes(1);
    close();
    closeOther();
  });

  it("does nothing without Web Locks", async () => {
    const cleanUp = vi.fn(async () => {});
    openProjectSession(projectId(), cleanUp, null)();
    await settle();
    expect(cleanUp).not.toHaveBeenCalled();
  });
});
