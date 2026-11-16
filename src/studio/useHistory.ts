"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { appRepository } from "@/adapters/storage/appRepository";
import { createHistory, type Command, type CommandResult, type HistoryState } from "@/core/commands";
import { editorStore } from "@/store/useEditor";
import { isTextEntry } from "./keyboard";

const NOTHING: HistoryState = { canUndo: false, canRedo: false };

// Undo and redo for the open project. A new history per project, in memory only: leaving
// the studio or opening another animation starts with nothing to undo.
// Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and Ctrl+Y redo, except while typing in a field
// (the field's own undo wins there).
export function useHistory(projectId: string | null) {
  // appRepository is passed, not called: rendering (also on the server) must not open storage.
  const history = useMemo(() => (projectId ? createHistory(appRepository) : null), [projectId]);
  const subscribe = useCallback((listener: () => void) => history?.subscribe(listener) ?? (() => {}), [history]);
  const state = useSyncExternalStore(subscribe, () => history?.state() ?? NOTHING, () => NOTHING);

  // Resolves once the change is saved: true, or false if it failed. A failure is logged, not
  // thrown: the timeline simply doesn't change (full storage gets its own message in step 20).
  const run = useCallback(async (command: Command): Promise<boolean> => {
    if (!history) return false;
    return history.run(command).then(
      (result) => { applyResult(result); return true; },
      (error) => { console.warn(`Couldn't ${command.label.toLowerCase()}`, error); return false; },
    );
  }, [history]);

  const undo = useCallback(() => {
    if (history) void history.undo().then(applyResult, (error) => console.warn("Couldn't undo", error));
  }, [history]);

  const redo = useCallback(() => {
    if (history) void history.redo().then(applyResult, (error) => console.warn("Couldn't redo", error));
  }, [history]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (key === "y" && event.ctrlKey) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { ...state, run, undo, redo };
}

// The store learns about a change from storage a moment after the command finished
// (useProject), so select once the frames are there.
function applyResult(result: CommandResult | undefined) {
  const ids = result?.select;
  if (!ids) return;
  const present = () => ids.every((id) => id in editorStore.getState().frames);
  if (present()) { editorStore.getState().select(ids); return; }
  const stop = editorStore.subscribe(() => {
    if (!present()) return;
    stop();
    clearTimeout(timeout);
    editorStore.getState().select(ids);
  });
  const timeout = setTimeout(stop, 2000);   // they never arrived (another tab changed things): give up
}
