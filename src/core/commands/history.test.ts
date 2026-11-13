import { describe, expect, it } from "vitest";
import { createHistory, type Command } from "@/core/commands";
import type { ProjectRepository } from "@/core/model";

// History doesn't look inside commands, so these tests use commands that edit a plain list.
// (The real frame commands are tested against storage in adapters/storage/frameCommands.test.ts.)
const repository = {} as ProjectRepository;

function list() {
  const items: string[] = [];
  const add = (item: string, options: { failDo?: boolean; failUndo?: boolean } = {}): Command => ({
    label: `Add ${item}`,
    async do() {
      await Promise.resolve();
      if (options.failDo) throw new Error("do failed");
      items.push(item);
    },
    async undo() {
      await Promise.resolve();
      if (options.failUndo) throw new Error("undo failed");
      items.splice(items.lastIndexOf(item), 1);
    },
  });
  return { items, add };
}

describe("History", () => {
  it("does, undoes and redoes commands in order", async () => {
    const { items, add } = list();
    const history = createHistory(repository);
    await history.run(add("a"));
    await history.run(add("b"));
    expect(items).toEqual(["a", "b"]);

    await history.undo();
    expect(items).toEqual(["a"]);
    await history.undo();
    expect(items).toEqual([]);
    expect(await history.undo()).toBeUndefined();   // nothing left: no-op

    await history.redo();
    await history.redo();
    expect(items).toEqual(["a", "b"]);
    expect(await history.redo()).toBeUndefined();
  });

  it("says what can be undone and redone, with labels", async () => {
    const { add } = list();
    const history = createHistory(repository);
    expect(history.state()).toEqual({ canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined });
    await history.run(add("a"));
    expect(history.state()).toMatchObject({ canUndo: true, canRedo: false, undoLabel: "Add a" });
    await history.undo();
    expect(history.state()).toMatchObject({ canUndo: false, canRedo: true, redoLabel: "Add a" });
  });

  it("clears redo when a new command runs", async () => {
    const { items, add } = list();
    const history = createHistory(repository);
    await history.run(add("a"));
    await history.undo();
    await history.run(add("b"));
    expect(history.state().canRedo).toBe(false);
    await history.redo();
    expect(items).toEqual(["b"]);
  });

  it("keeps only the last `limit` commands", async () => {
    const { items, add } = list();
    const history = createHistory(repository, 3);
    for (const item of ["a", "b", "c", "d", "e"]) await history.run(add(item));
    for (let i = 0; i < 5; i++) await history.undo();
    expect(items).toEqual(["a", "b"]);   // only c, d and e could be undone
  });

  it("runs quick presses one after another, never overlapping", async () => {
    const { items, add } = list();
    const history = createHistory(repository);
    await Promise.all([history.run(add("a")), history.run(add("b")), history.run(add("c"))]);
    await Promise.all([history.undo(), history.undo()]);
    expect(items).toEqual(["a"]);
  });

  it("doesn't record a command that failed, and carries on afterwards", async () => {
    const { items, add } = list();
    const history = createHistory(repository);
    await expect(history.run(add("a", { failDo: true }))).rejects.toThrow("do failed");
    expect(history.state().canUndo).toBe(false);
    await history.run(add("b"));
    expect(items).toEqual(["b"]);
  });

  it("keeps a command on the undo stack when its undo fails", async () => {
    const { add } = list();
    const history = createHistory(repository);
    await history.run(add("a", { failUndo: true }));
    await expect(history.undo()).rejects.toThrow("undo failed");
    expect(history.state()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("tells subscribers about changes, with a new state object each time", async () => {
    const { add } = list();
    const history = createHistory(repository);
    let calls = 0;
    const stop = history.subscribe(() => calls++);
    const before = history.state();
    expect(history.state()).toBe(before);   // unchanged: the same object
    await history.run(add("a"));
    expect(calls).toBe(1);
    expect(history.state()).not.toBe(before);
    stop();
    await history.undo();
    expect(calls).toBe(1);
  });

  it("with a getter, only looks the repository up when a command runs", async () => {
    let lookups = 0;
    const seen: ProjectRepository[] = [];
    const history = createHistory(() => { lookups++; return repository; });
    expect(lookups).toBe(0);   // creating it (while rendering on the server) touches no storage
    await history.run({ label: "Look", do: async (repo) => { seen.push(repo); }, undo: async (repo) => { seen.push(repo); } });
    await history.undo();
    expect(lookups).toBe(2);
    expect(seen).toEqual([repository, repository]);
  });

  it("returns what the command says to select", async () => {
    const history = createHistory(repository);
    const command: Command = { label: "Pick", do: async () => ({ select: ["x"] }), undo: async () => ({ select: ["y"] }) };
    expect(await history.run(command)).toEqual({ select: ["x"] });
    expect(await history.undo()).toEqual({ select: ["y"] });
    expect(await history.redo()).toEqual({ select: ["x"] });
  });
});
