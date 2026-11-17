"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, ChevronLeft, Download, Image as ImageIcon, Redo2, Shapes, Undo2 } from "lucide-react";
import { CameraPanel } from "@/features/camera/CameraPanel";
import { ObjectEditor } from "@/features/objects/ObjectEditor";
import { ObjectsPanel } from "@/features/objects/ObjectsPanel";
import { OnionSkin } from "@/features/onion-skin/OnionSkin";
import { SeeThroughMenu } from "@/features/onion-skin/SeeThroughMenu";
import { AdjustControls } from "@/features/picture/AdjustControls";
import { PictureControls } from "@/features/picture/PictureControls";
import { StageEditor } from "@/features/picture/StageEditor";
import { editorStore, useEditor } from "@/store/useEditor";
import { CameraMessage } from "./CameraMessage";
import { CameraView } from "./CameraView";
import { PlaybackBar } from "./PlaybackBar";
import { useRememberedStudio } from "./remembered";
import { SafeZone } from "./SafeZone";
import { PanelTab, SidePanel } from "./SidePanel";
import { StagePicture } from "./StagePicture";
import { StageView } from "./StageView";
import { StorageNotice } from "./StorageNotice";
import { Timeline } from "./timeline/Timeline";
import { useCamera } from "./useCamera";
import { useCapture } from "./useCapture";
import { useHistory } from "./useHistory";
import { usePlayback } from "./usePlayback";
import { useProject } from "./useProject";
import { useStorageWatch } from "./useStorageWatch";
import { useStudioCommands } from "./useStudioCommands";
import "./studio.scss";

// The studio screen.
export function Studio() {
  const projectId = useSearchParams().get("project");
  const status = useProject(projectId);
  const projectName = useEditor((state) => state.project?.name);
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  const isPlaying = useEditor((state) => state.isPlaying);
  const panelTab = useEditor((state) => state.panelTab);
  const stageTool = panelTab ?? "camera";   // the open tab (the first, Camera, when none was chosen)
  const camera = useCamera();
  const video = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const onVideo = useCallback((element: HTMLVideoElement | null) => { video.current = element; setVideoReady(element !== null); }, []);
  const canCapture = camera.status === "live" && status === "ready" && videoReady;
  const history = useHistory(projectId);
  const { capture, capturing } = useCapture(video, canCapture, history.run);
  usePlayback();
  useStorageWatch();   // the "almost full" warning
  useRememberedStudio();   // see-through, loop and selection, as they were left (remembered.ts)
  // What the stage shows:
  //   playing  the animation at the playhead (over the camera, if it's on)
  //   camera   the live camera, with the see-through ghost over it
  //   frame    the camera is off: the selected (or last) picture
  //   empty    the camera is off and there are no pictures: the camera message
  const stageMode = isPlaying ? "playing" : camera.stream ? "camera" : hasPictures ? "frame" : "empty";
  const editing = stageMode === "frame" && stageTool === "picture";   // the Picture tab's tools on the stage
  const commands = useStudioCommands(projectId, history.run);   // every undoable change, one object
  const objectSaves = { objects: commands.setObjects, overlays: commands.setOverlays };   // where an object lives: its picture, or in time
  const ready = useReady(status !== "loading" && camera.settled);

  // Development only: poke at the store from the browser console (window.editorStore.getState()).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    Object.assign(window, { editorStore });
  }, []);

  if (status === "missing") {
    return (
      <div className="nsc-studio is-missing is-ready">
        <div className="missing-message">
          <h1>This animation isn&apos;t here</h1>
          <p>It may have been deleted, or it was made in another browser or on another computer.</p>
          <Link className="icon-button is-primary" href="/studio">Start a new animation</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`nsc-studio${ready ? " is-ready" : ""}`} aria-busy={!ready}>
      <header className="toolbar">
        <Link className="icon-button" href="/" aria-label="All projects"><ChevronLeft size={24} /></Link>
        <h1 className="project-name">{projectName ?? ""}</h1>
        <div className="toolbar-actions">
          <button type="button" className="icon-button" aria-label="Undo" title={history.undoLabel ? `Undo: ${history.undoLabel}` : "Nothing to undo"} disabled={!history.canUndo} onClick={history.undo}><Undo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Redo" title={history.redoLabel ? `Redo: ${history.redoLabel}` : "Nothing to redo"} disabled={!history.canRedo} onClick={history.redo}><Redo2 size={24} /></button>
          <button type="button" className="icon-button" aria-label="Save as video" disabled><Download size={24} /><span className="desktop-only">Save as video</span></button>
        </div>
      </header>

      <StorageNotice />

      <main className="stage" aria-label="Stage">
        <div className={`stage-frame${capturing ? " is-capturing" : ""}`}>
          {camera.stream ? (
            <>
              <CameraView stream={camera.stream} onVideo={onVideo} />
              {stageMode === "camera" && <OnionSkin mode="camera" />}
              {stageMode === "playing" && <StagePicture />}
              <SafeZone />
            </>
          ) : stageMode !== "empty" ? (
            <>
              <StageView zoomable={editing}>
                <StagePicture />
                {stageMode === "frame" && <OnionSkin mode="frame" />}
                <SafeZone />
                {/* Each tab's tools on the stage, only while that tab is open. */}
                {editing && <StageEditor save={commands.transformPictures} />}
                {stageMode === "frame" && stageTool === "objects" && <ObjectEditor saves={objectSaves} />}
              </StageView>
              <div className="stage-note"><CameraMessage camera={camera} more /></div>
            </>
          ) : <CameraMessage camera={camera} />}
        </div>
      </main>

      <SidePanel active={panelTab} onChange={editorStore.getState().setPanelTab}>
        <PanelTab id="camera" label="Camera" icon={<Camera size={31} />}>
          <CameraPanel camera={camera} canCapture={canCapture} onCapture={capture} capturing={capturing} />
        </PanelTab>
        <PanelTab id="picture" label="Picture" title="Adjust your picture" icon={<ImageIcon size={31} />}>
          <PictureControls save={commands.transformPictures} />
          <AdjustControls save={commands.adjustPictures} />
        </PanelTab>
        <PanelTab id="objects" label="Objects" title="Things on the picture" icon={<Shapes size={31} />}>
          <ObjectsPanel saves={objectSaves} onStage={stageMode === "frame"} />
        </PanelTab>
      </SidePanel>

      <Timeline onOverlays={commands.setOverlays} onDelete={commands.deletePictures} onDuplicate={commands.duplicatePictures} onResize={commands.resizePictures} onReorder={commands.reorderPictures} />

      <PlaybackBar onSpeed={commands.setSpeed} onSafeMargin={commands.setSafeMargin}>
        <SeeThroughMenu />
      </PlaybackBar>
    </div>
  );
}

const READY_WAIT = 2000;   // ms: show the studio by then even if the camera is still starting

// The studio fades in once it looks as it was left: the animation loaded with its remembered
// settings (tab, see-through, selection, timeline zoom and scroll are restored as it arrives),
// and the camera running or known to stay off. Shown earlier, it would show defaults and then
// jump. A slow camera doesn't hold it back for long.
function useReady(settled: boolean): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), READY_WAIT);
    return () => clearTimeout(timer);
  }, []);
  return settled || waited;
}
