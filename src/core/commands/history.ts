import type { ProjectRepository } from "../model";
import type { Command, CommandResult } from "./command";

export const HISTORY_LIMIT = 100;

export type HistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;   // the command undo would reverse
  redoLabel?: string;
};

export type History = {
  // Does the command and remembers it. A new command clears redo.
  run(command: Command): Promise<CommandResult>;
  // Undefined when there's nothing to undo or redo.
  undo(): Promise<CommandResult | undefined>;
  redo(): Promise<CommandResult | undefined>;
  // The same object until something changes (for React's useSyncExternalStore).
  state(): HistoryState;
  subscribe(listener: () => void): () => void;
};

// Undo and redo for one open project, in memory only. Operations run one after another,
// never overlapping: pressing Ctrl+Z three times quickly undoes three commands in order.
// A command that fails isn't recorded, and one whose undo or redo fails stays where it was.
//
// `repository` may be a function that returns it: it's then only called when a command runs,
// so a history can be created where storage doesn't exist (server rendering).
export function createHistory(repositoryOrGetter: ProjectRepository | (() => ProjectRepository), limit = HISTORY_LIMIT): History {
  const repo = () => (typeof repositoryOrGetter === "function" ? repositoryOrGetter() : repositoryOrGetter);
  const undoStack: Command[] = [];
  const redoStack: Command[] = [];
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  let snapshot = describe();

  function describe(): HistoryState {
    return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undoLabel: undoStack.at(-1)?.label, redoLabel: redoStack.at(-1)?.label };
  }

  function changed() {
    snapshot = describe();
    listeners.forEach((listener) => listener());
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);   // a failure doesn't block what comes next
    return result;
  }

  // Moves the top command from one stack to the other, once `action` succeeded.
  function step(from: Command[], to: Command[], action: (command: Command) => Promise<CommandResult>) {
    return enqueue(async () => {
      const command = from.at(-1);
      if (!command) return undefined;
      const result = await action(command);
      from.pop();
      to.push(command);
      changed();
      return result;
    });
  }

  return {
    run: (command) => enqueue(async () => {
      const result = await command.do(repo());
      undoStack.push(command);
      if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
      redoStack.length = 0;
      changed();
      return result;
    }),
    undo: () => step(undoStack, redoStack, (command) => command.undo(repo())),
    redo: () => step(redoStack, undoStack, (command) => command.do(repo())),
    state: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
