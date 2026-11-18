"use client";

import { ChevronDown, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exportGif } from "@/adapters/export/gifExport";
import { BIG_GIF_BYTES, GIF_ENCODING, GIF_QUALITIES, GIF_SIZES, gifFileName, gifFrames, gifSize, type GifQuality, type GifSize } from "@/core/export";
import { projectExportRect } from "@/core/render";
import { orderedFrames } from "@/store/editorStore";
import { editorStore, useEditor } from "@/store/useEditor";
import { bitmaps } from "@/studio/media";
import { remembered, useRememberedState } from "@/studio/remembered";
import { useDropdown } from "@/studio/useDropdown";
import "./_gif-export.scss";

// Save as GIF (step 25), in the toolbar: the button makes the GIF and downloads it; the arrow
// beside it opens its options (remembered): the size (small, medium, or full size: the safe zone's
// part as it is) and the quality, a slider of three steps (GIF_ENCODING: lower squeezes harder). While it's made the button shows how far it got, and a
// cross stops it. The GIF is what's inside the dotted line on the stage (the safe zone), every
// picture as long as it's held, with its objects and the overlays showing then, looping.
// A big file (over 20 MB) is still saved; a note says so, and that Small makes a lighter one.

const SIZE_NAMES: Record<GifSize, string> = { small: "Small", medium: "Medium", full: "Full size" };
const QUALITY_NAMES: Record<GifQuality, string> = { low: "low, smallest file", medium: "medium", high: "high, biggest file" };

type Note = { text: string; problem: boolean } | null;

export function GifExportMenu() {
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  // How wide each size is for this animation (full depends on its size and safe zone).
  const project = useEditor((state) => state.project);
  const exported = projectExportRect(project ?? { width: 1280, height: 720 });
  const [size, setSize] = useRememberedState<GifSize>(remembered.gifSize, "medium");
  const [quality, setQuality] = useRememberedState<GifQuality>(remembered.gifQuality, "medium");
  const { open, toggle, ref } = useDropdown();
  const [progress, setProgress] = useState<number | null>(null);   // null: not making one
  const [note, setNote] = useState<Note>(null);
  const stopper = useRef<AbortController | null>(null);

  // A note goes after a while; stop a GIF still being made when the studio closes.
  useEffect(() => { if (!note) return; const timer = setTimeout(() => setNote(null), 8000); return () => clearTimeout(timer); }, [note]);
  useEffect(() => () => stopper.current?.abort(), []);

  const save = async () => {
    const { project } = editorStore.getState();
    const frames = orderedFrames(editorStore.getState());
    if (!project || frames.length === 0 || stopper.current) return;
    const stop = new AbortController();
    stopper.current = stop;
    setNote(null);
    setProgress(0);
    try {
      const rect = projectExportRect(project);
      const overlays = project.overlays ?? [];
      const blob = await exportGif({
        scene: { width: project.width, height: project.height, frames, overlays },
        rect,
        size: gifSize(rect, size),
        frames: gifFrames(frames, overlays, project.fps),
        encoding: GIF_ENCODING[quality],
        loadImage: (imageId) => bitmaps.load(imageId),
        onProgress: setProgress,
        signal: stop.signal,
      });
      const name = gifFileName(project.name);
      download(blob, name);
      const megabytes = Math.round(blob.size / (1024 * 1024));
      setNote(blob.size > BIG_GIF_BYTES ? { text: `Saved ${name}. It's big (${megabytes} MB): Small makes a lighter one.`, problem: true } : { text: `Saved ${name}`, problem: false });
    } catch (error) {
      if (!stop.signal.aborted) { console.warn("GIF export failed", error); setNote({ text: "The GIF couldn't be made. Try again, or try Small.", problem: true }); }
    } finally {
      stopper.current = null;
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <div ref={ref} className="nsc-gif-export option-menu opens-below">
      <button type="button" className="icon-button toggle" aria-label={busy ? `Saving GIF, ${Math.round(progress * 100)}%` : "Save as GIF"} title={hasPictures ? `Save the animation as a GIF (${SIZE_NAMES[size].toLowerCase()})` : "Take a picture first"} disabled={!hasPictures || busy} aria-busy={busy} onClick={() => void save()}>
        <Download size={24} />
        <span className="desktop-only">{busy ? `Saving ${Math.round(progress * 100)}%` : "Save as GIF"}</span>
        {busy && <span className="progress" style={{ width: `${Math.round(progress * 100)}%` }} aria-hidden="true" />}
      </button>
      {busy
        ? <button type="button" className="icon-button more" aria-label="Stop saving" title="Stop saving" onClick={() => stopper.current?.abort()}><X size={20} /></button>
        : <button type="button" className="icon-button more" aria-label="GIF options" aria-expanded={open} aria-haspopup="true" onClick={toggle}><ChevronDown size={20} /></button>}

      {open && !busy && (
        <div className="options" role="group" aria-label="GIF options">
          <div className="option">
            <span>Size</span>
            <div className="sizes" role="group" aria-label="GIF size">
              {GIF_SIZES.map((option) => (
                <button key={option} type="button" className={`icon-button size-option${option === size ? " is-on" : ""}`} aria-pressed={option === size} onClick={() => setSize(option)}>
                  {SIZE_NAMES[option]} <span className="size-width">{gifSize(exported, option).width} px wide</span>
                </button>
              ))}
            </div>
          </div>
          <label className="option">
            <span>Quality: {QUALITY_NAMES[quality]}</span>
            <input type="range" min={0} max={GIF_QUALITIES.length - 1} step={1} value={GIF_QUALITIES.indexOf(quality)} aria-label="Quality" aria-valuetext={QUALITY_NAMES[quality]} onChange={(event) => setQuality(GIF_QUALITIES[Number(event.target.value)])} />
          </label>
        </div>
      )}
      {note && <p className={`export-note${note.problem ? " is-problem" : ""}`} role="status">{note.text}</p>}
    </div>
  );
}

// Hands the file to the browser as a download.
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
