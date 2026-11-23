"use client";

import { ChevronDown, Download, X } from "lucide-react";
import { exportGif } from "@/adapters/export/gifExport";
import { BIG_GIF_BYTES, GIF_ENCODING, GIF_QUALITIES, GIF_SIZES, gifFileName, gifFrames, gifSize, type GifQuality, type GifSize } from "@/core/export";
import { projectExportRect } from "@/core/render";
import { useEditor } from "@/store/useEditor";
import { bitmaps } from "@/studio/media";
import { remembered, useRememberedState } from "@/studio/remembered";
import { useDropdown } from "@/studio/useDropdown";
import { useExport } from "@/studio/useExport";
import "./_gif-export.scss";

// Save as GIF (step 25), in the toolbar: the button makes the GIF and downloads it; the arrow
// beside it opens its options (remembered): the size, a slider of three steps (small, medium, or full
// size: the safe zone's part as it is), and the quality, another (GIF_ENCODING: lower squeezes harder).
// While it's made the button shows how far it got, and a cross stops it (useExport). The GIF is
// what's inside the dotted line on the stage (the safe zone), every picture as long as it's held,
// with its objects and the overlays showing then, looping. A big file (over 20 MB) is still saved;
// a note says so, and that Small makes a lighter one.

const SIZE_NAMES: Record<GifSize, string> = { small: "Small", medium: "Medium", full: "Full size" };
const QUALITY_NAMES: Record<GifQuality, string> = { low: "low, smallest file", medium: "medium", high: "high, biggest file" };

export function GifExportMenu() {
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  // How wide each size is for this animation (full depends on its size and safe zone).
  const project = useEditor((state) => state.project);
  const exported = projectExportRect(project ?? { width: 1280, height: 720 });
  const [size, setSize] = useRememberedState<GifSize>(remembered.gifSize, "medium");
  const [quality, setQuality] = useRememberedState<GifQuality>(remembered.gifQuality, "medium");
  const { open, toggle, ref } = useDropdown();
  const { run, progress, busy, note, stop } = useExport();

  const save = () => run({
    make: ({ project, frames, signal, onProgress }) => {
      const rect = projectExportRect(project);
      const overlays = project.overlays ?? [];
      return exportGif({
        scene: { width: project.width, height: project.height, frames, overlays },
        rect,
        size: gifSize(rect, size),
        frames: gifFrames(frames, overlays, project.fps),
        encoding: { ...GIF_ENCODING[quality], transparent: frames.some((frame) => frame.empty) },   // empty pictures stay see-through
        loadImage: (imageId) => bitmaps.load(imageId),
        onProgress,
        signal,
      });
    },
    name: (project) => gifFileName(project.name),
    saved: (blob, name) => (blob.size > BIG_GIF_BYTES ? { text: `Saved ${name}. It's big (${Math.round(blob.size / (1024 * 1024))} MB): Small makes a lighter one.`, problem: true } : { text: `Saved ${name}`, problem: false }),
    failed: "The GIF couldn't be made. Try again, or try Small.",
  });

  const sizeText = `${SIZE_NAMES[size].toLowerCase()}, ${gifSize(exported, size).width} px wide`;
  const percent = Math.round((progress ?? 0) * 100);
  return (
    <div ref={ref} className="nsc-gif-export export-menu option-menu opens-below">
      <button type="button" className="icon-button toggle" aria-label={busy ? `Saving GIF, ${percent}%` : "Save as GIF"} title={hasPictures ? `Save the animation as a GIF (${SIZE_NAMES[size].toLowerCase()})` : "Take a picture first"} disabled={!hasPictures || busy} aria-busy={busy} onClick={() => void save()}>
        <Download size={24} />
        <span className="desktop-only">{busy ? `Saving ${percent}%` : "Save as GIF"}</span>
        {busy && <span className="progress" style={{ width: `${percent}%` }} aria-hidden="true" />}
      </button>
      {busy
        ? <button type="button" className="icon-button more" aria-label="Stop saving" title="Stop saving" onClick={stop}><X size={20} /></button>
        : <button type="button" className="icon-button more" aria-label="GIF options" aria-expanded={open} aria-haspopup="true" onClick={toggle}><ChevronDown size={20} /></button>}

      {open && !busy && (
        <div className="options" role="group" aria-label="GIF options">
          <label className="option">
            <span>Size: {sizeText}</span>
            <input type="range" min={0} max={GIF_SIZES.length - 1} step={1} value={GIF_SIZES.indexOf(size)} aria-label="Size" aria-valuetext={sizeText} onChange={(event) => setSize(GIF_SIZES[Number(event.target.value)])} />
          </label>
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
