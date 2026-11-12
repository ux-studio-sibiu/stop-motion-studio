"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, ChevronLeft, Download, Layers, Play, Redo2, Undo2 } from "lucide-react";
import { CameraMessage } from "./CameraMessage";
import { CameraPanel } from "./CameraPanel";
import { CameraView } from "./CameraView";
import { useCamera } from "./useCamera";
import "./studio.scss";

// The studio screen. Areas still holding a placeholder are filled by later steps
// (timeline 05/10, playback 16, properties 18).
export function Studio() {
  const projectId = useSearchParams().get("project");
  const camera = useCamera();

  return (
    <div className="nsc-studio">
      <header className="toolbar">
        <Link className="icon-button" href="/" aria-label="All projects"><ChevronLeft size={24} /></Link>
        <h1 className="project-name">{projectId ? "My animation" : "New animation"}</h1>
        <div className="toolbar-actions">
          <button type="button" className="icon-button" aria-label="Undo" disabled><Undo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Redo" disabled><Redo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Save as video" disabled><Download size={24} /><span className="desktop-only">Save as video</span></button>
        </div>
      </header>

      <CameraPanel camera={camera} />

      <main className="stage" aria-label="Stage">
        <div className="stage-frame">
          {camera.stream ? <CameraView stream={camera.stream} /> : <CameraMessage camera={camera} />}
        </div>
      </main>

      <aside className="properties-panel" aria-label="Picture settings">
        <h2 className="panel-title">Picture</h2>
        <p className="placeholder">Move, size and brightness for the selected picture (steps 18-20).</p>
      </aside>

      <section className="timeline" aria-label="Pictures">
        <ol className="frames">
          <li className="frame-slot" aria-hidden="true" />
          <li className="frame-slot" aria-hidden="true" />
          <li className="frame-slot" aria-hidden="true" />
          <li className="frame-slot is-next"><Camera size={24} /><span className="visually-hidden">Next picture goes here</span></li>
        </ol>
      </section>

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
