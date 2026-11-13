"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Download, Layers, Play, Redo2, Undo2 } from "lucide-react";
import { editorStore, useEditor } from "@/store/useEditor";
import { CameraMessage } from "./CameraMessage";
import { CameraPanel } from "./CameraPanel";
import { CameraView } from "./CameraView";
import { Timeline } from "./Timeline";
import { useCamera } from "./useCamera";
import { useCapture } from "./useCapture";
import { useHistory } from "./useHistory";
import { useProject } from "./useProject";
import { deleteFrames, duplicateFrames, setHold } from "@/core/commands";
import "./studio.scss";

// The studio screen. Areas still holding a placeholder are filled by later steps
// (playback 16, properties 18).
export function Studio() {
  const projectId = useSearchParams().get("project");
  const status = useProject(projectId);
  const projectName = useEditor((state) => state.project?.name);
  const camera = useCamera();
  const video = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const onVideo = useCallback((element: HTMLVideoElement | null) => { video.current = element; setVideoReady(element !== null); }, []);
  const canCapture = camera.status === "live" && status === "ready" && videoReady;
  const history = useHistory(projectId);
  const { capture, capturing } = useCapture(video, canCapture, history.run);
  const duplicate = (ids: readonly string[]) => {
    const { project, frames } = editorStore.getState();
    if (!project) return;
    void history.run(duplicateFrames(project.id, ids.flatMap((id) => frames[id] ?? []), project.frameIds));
  };

  // Development only: poke at the store from the browser console (window.editorStore.getState()).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    Object.assign(window, { editorStore });
  }, []);

  if (status === "missing") {
    return (
      <div className="nsc-studio is-missing">
        <div className="missing-message">
          <h1>This animation isn&apos;t here</h1>
          <p>It may have been deleted, or it was made in another browser or on another computer.</p>
          <Link className="icon-button is-primary" href="/studio">Start a new animation</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="nsc-studio">
      <header className="toolbar">
        <Link className="icon-button" href="/" aria-label="All projects"><ChevronLeft size={24} /></Link>
        <h1 className="project-name">{projectName ?? ""}</h1>
        <div className="toolbar-actions">
          <button type="button" className="icon-button" aria-label="Undo" title={history.undoLabel ? `Undo: ${history.undoLabel}` : "Nothing to undo"} disabled={!history.canUndo} onClick={history.undo}><Undo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Redo" title={history.redoLabel ? `Redo: ${history.redoLabel}` : "Nothing to redo"} disabled={!history.canRedo} onClick={history.redo}><Redo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Save as video" disabled><Download size={24} /><span className="desktop-only">Save as video</span></button>
        </div>
      </header>

      <CameraPanel camera={camera} canCapture={canCapture} onCapture={capture} capturing={capturing} />

      <main className="stage" aria-label="Stage">
        <div className={`stage-frame${capturing ? " is-capturing" : ""}`}>
          {camera.stream ? <CameraView stream={camera.stream} onVideo={onVideo} /> : <CameraMessage camera={camera} />}
        </div>
      </main>

      <aside className="properties-panel" aria-label="Picture settings">
        <h2 className="panel-title">Picture</h2>
        <p className="placeholder">Move, size and brightness for the selected picture (steps 18-20).</p>
      </aside>

      <Timeline onDelete={(ids) => projectId && history.run(deleteFrames(projectId, ids))} onDuplicate={(ids) => duplicate(ids)} onResize={(changes) => (projectId ? history.run(setHold(projectId, changes)) : Promise.resolve(false))} />

      <footer className="playback-bar">
        <button type="button" className="big-button is-play" aria-label="Play" disabled><Play size={40} /></button>
        <label className="speed">
          <span>Speed</span>
          <input type="range" min={5} max={15} defaultValue={8} disabled />
        </label>
        <button type="button" className="icon-button" aria-label="See-through" disabled><Layers size={24} /><span className="desktop-only">See-through</span></button>
      </footer>
    </div>
  );
}
