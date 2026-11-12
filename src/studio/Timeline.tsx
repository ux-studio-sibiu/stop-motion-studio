"use client";

import { useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import type { Frame } from "@/core/model";
import { editorStore, useEditor, useOrderedFrames } from "@/store/useEditor";
import { thumbs } from "./media";

// The picture strip. Equal widths for now; step 10 makes it time-scaled with a ruler.
export function Timeline() {
  const frames = useOrderedFrames();
  const selection = useEditor((state) => state.selection);
  const next = useRef<HTMLLIElement>(null);

  // Keep the newest picture (and the slot for the next one) in view while capturing.
  useEffect(() => {
    next.current?.scrollIntoView({ block: "nearest", inline: "end", behavior: "smooth" });
  }, [frames.length]);

  return (
    <section className="timeline" aria-label="Pictures">
      <ol className="frames">
        {frames.map((frame, index) => <FrameThumb key={frame.id} frame={frame} number={index + 1} selected={selection.includes(frame.id)} />)}
        <li ref={next} className="frame-slot is-next">
          <Camera size={24} />
          <span className={frames.length ? "visually-hidden" : "next-hint"}>{frames.length ? "Next picture goes here" : "Your pictures appear here"}</span>
        </li>
      </ol>
    </section>
  );
}

function FrameThumb({ frame, number, selected }: { frame: Frame; number: number; selected: boolean }) {
  const url = thumbs.url(frame.imageId);

  return (
    <li className={`frame-thumb${selected ? " is-selected" : ""}`}>
      <button type="button" aria-label={`Picture ${number}`} aria-pressed={selected} onClick={() => editorStore.getState().select([frame.id])}>
        {/* A blob: URL from the thumbnail cache; next/image can't optimise those. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" draggable={false} />}
        <span className="frame-number">{number}</span>
      </button>
    </li>
  );
}
