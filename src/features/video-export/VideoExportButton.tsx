"use client";

import { Film, X } from "lucide-react";
import { useEffect, useState } from "react";
import { exportVideo, videoFormat, type VideoFormat } from "@/adapters/export/videoExport";
import { mixSounds } from "@/adapters/sound/sound";
import { exportFileName, videoFrames } from "@/core/export";
import { soundsOf, totalTicks } from "@/core/model";
import { projectExportRect } from "@/core/render";
import { useEditor } from "@/store/useEditor";
import { bitmaps } from "@/studio/media";
import { useExport } from "@/studio/useExport";

// Save as MP4 (step 26), in the Save menu above Save as GIF: an MP4 (H.264), or a WebM (VP9)
// where the browser can't make MP4s, of what's inside the dotted line at its full size, every
// picture as long as it's held. While it's made the button shows how far it got, and a cross
// stops it (useExport). Where the browser can make neither, there's no button at all. The sound
// row is mixed in (AAC in an MP4, Opus in a WebM) where the browser can encode it.
export function VideoExportButton() {
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const margin = useEditor((state) => state.project?.safeMargin);
  const [format, setFormat] = useState<VideoFormat | null>(null);   // null: not known yet, or none
  const { run, progress, busy, note, stop } = useExport();

  // What this browser can encode at this size (WebCodecs is asked; it can depend on the size).
  useEffect(() => {
    let current = true;
    void videoFormat(projectExportRect({ width, height, safeMargin: margin })).then((found) => { if (current) setFormat(found); });
    return () => { current = false; };
  }, [width, height, margin]);

  if (!format) return null;
  const kind = format.extension === "mp4" ? "MP4" : "WebM";   // the button says which: Save as MP4, or Save as WebM where the browser can't make MP4s

  const save = () => run({
    make: async ({ project, frames, signal, onProgress }) => {
      const overlays = project.overlays ?? [];
      const audio = await mixSounds(soundsOf(project), project.fps, totalTicks(frames));   // the sound row (step 29b)
      return exportVideo({
        scene: { width: project.width, height: project.height, frames, overlays },
        rect: projectExportRect(project),
        frames: videoFrames(frames, overlays, project.fps),
        format,
        loadImage: (imageId) => bitmaps.load(imageId),
        audio,
        onProgress,
        signal,
      });
    },
    name: (project) => exportFileName(project.name, format.extension),
    failed: "The video couldn't be made. Try again.",
  });

  const percent = Math.round((progress ?? 0) * 100);
  return (
    <div className="nsc-video-export export-menu option-menu">
      <button type="button" className="icon-button toggle" aria-label={busy ? `Saving ${kind}, ${percent}%` : `Save as ${kind}`} title={hasPictures ? `Save the animation as a video (${format.extension.toUpperCase()})` : "Take a picture first"} disabled={!hasPictures || busy} aria-busy={busy} onClick={() => void save()}>
        <Film size={24} />
        <span className="desktop-only">{busy ? `Saving ${percent}%` : `Save as ${kind}`}</span>
        {busy && <span className="progress" style={{ width: `${percent}%` }} aria-hidden="true" />}
      </button>
      {busy && <button type="button" className="icon-button more" aria-label="Stop saving" title="Stop saving" onClick={stop}><X size={20} /></button>}
      {note && <p className={`export-note${note.problem ? " is-problem" : ""}`} role="status">{note.text}</p>}
    </div>
  );
}
