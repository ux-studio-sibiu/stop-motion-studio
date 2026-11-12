"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Download, Layers, Play, Redo2, Undo2 } from "lucide-react";
import { createProject } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { CameraMessage } from "./CameraMessage";
import { CameraPanel } from "./CameraPanel";
import { CameraView } from "./CameraView";
import { clearMedia } from "./media";
import { Timeline } from "./Timeline";
import { useCamera } from "./useCamera";
import { useCapture } from "./useCapture";
import "./studio.scss";

// The studio screen. Areas still holding a placeholder are filled by later steps
// (playback 16, properties 18).
export function Studio() {
  const projectId = useSearchParams().get("project");
  const projectName = useEditor((state) => state.project?.name);
  const camera = useCamera();
  const video = useRef<HTMLVideoElement | null>(null);
  const onVideo = useCallback((element: HTMLVideoElement | null) => { video.current = element; }, []);
  const { capture, capturing } = useCapture(video, camera.status === "live");

  // Until projects are saved (step 07), every visit starts a fresh, empty project,
  // and its photos are dropped on leaving.
  useEffect(() => {
    editorStore.getState().loadProject(createProject(), []);
    return () => { editorStore.getState().unloadProject(); clearMedia(); };
  }, [projectId]);

  // Development only: poke at the store from the browser console (window.editorStore.getState()).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    Object.assign(window, { editorStore });
  }, []);

  return (
    <div className="nsc-studio">
      <header className="toolbar">
        <Link className="icon-button" href="/" aria-label="All projects"><ChevronLeft size={24} /></Link>
        <h1 className="project-name">{projectName ?? ""}</h1>
        <div className="toolbar-actions">
          <button type="button" className="icon-button" aria-label="Undo" disabled><Undo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Redo" disabled><Redo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Save as video" disabled><Download size={24} /><span className="desktop-only">Save as video</span></button>
        </div>
      </header>

      <CameraPanel camera={camera} onCapture={capture} capturing={capturing} />

      <main className="stage" aria-label="Stage">
        <div className={`stage-frame${capturing ? " is-capturing" : ""}`}>
          {camera.stream ? <CameraView stream={camera.stream} onVideo={onVideo} /> : <CameraMessage camera={camera} />}
        </div>
      </main>

      <aside className="properties-panel" aria-label="Picture settings">
        <h2 className="panel-title">Picture</h2>
        <p className="placeholder">Move, size and brightness for the selected picture (steps 18-20).</p>
      </aside>

      <Timeline />

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
