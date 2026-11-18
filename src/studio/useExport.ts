"use client";

import { useEffect, useRef, useState } from "react";
import type { Frame, Project } from "@/core/model";
import { orderedFrames } from "@/store/editorStore";
import { editorStore } from "@/store/useEditor";

// Making a file from the animation and downloading it, the same for every export button (GIF,
// step 25; video, step 26): one at a time, with how far it got, a way to stop it, and a short note
// afterwards that goes by itself. A file still being made is stopped when the studio closes.

export type ExportNote = { text: string; problem: boolean };

// What an export gets: the animation as saved (not a change still being dragged), a signal that
// says when to stop, and where to report progress (0 to 1).
export type ExportJob = { project: Project; frames: Frame[]; signal: AbortSignal; onProgress: (fraction: number) => void };

export type ExportRecipe = {
  make: (job: ExportJob) => Promise<Blob>;
  name: (project: Project) => string;                // the file's name
  saved?: (blob: Blob, name: string) => ExportNote;   // the note afterwards; "Saved <name>" by default
  failed: string;                                    // the note when it couldn't be made
};

export function useExport() {
  const [progress, setProgress] = useState<number | null>(null);   // null: not making one
  const [note, setNote] = useState<ExportNote | null>(null);
  const stopper = useRef<AbortController | null>(null);

  useEffect(() => { if (!note) return; const timer = setTimeout(() => setNote(null), 8000); return () => clearTimeout(timer); }, [note]);
  useEffect(() => () => stopper.current?.abort(), []);

  const run = async ({ make, name, saved, failed }: ExportRecipe) => {
    const { project } = editorStore.getState();
    const frames = orderedFrames(editorStore.getState());
    if (!project || frames.length === 0 || stopper.current) return;
    const stop = new AbortController();
    stopper.current = stop;
    setNote(null);
    setProgress(0);
    try {
      const blob = await make({ project, frames, signal: stop.signal, onProgress: setProgress });
      const file = name(project);
      download(blob, file);
      setNote(saved?.(blob, file) ?? { text: `Saved ${file}`, problem: false });
    } catch (error) {
      if (!stop.signal.aborted) { console.warn("Export failed", error); setNote({ text: failed, problem: true }); }
    } finally {
      stopper.current = null;
      setProgress(null);
    }
  };

  return { run, progress, busy: progress !== null, note, stop: () => stopper.current?.abort() };
}

// Hands a file to the browser as a download.
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
