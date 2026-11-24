"use client";

import { MessageCircle, Pencil, Square, Type } from "lucide-react";
import { DRAWING, SHAPE, SPEECH_BUBBLE, TEXT } from "@/core/model";

// Each kind of object's icon: plain (lucide) on the timeline's overlay bars, where it's small, and
// coloured in the Objects tab's tiles (`coloured`), in the home page's paper colours with an ink
// outline, like cut-outs. A new kind adds a line to each; an unknown kind has none.
export function ObjectIcon({ kind, size = 24, coloured = false }: { kind: string; size?: number; coloured?: boolean }) {
  if (coloured) {
    const drawing = COLOURED[kind];
    return drawing ? <svg className="object-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{drawing}</svg> : null;
  }
  if (kind === SPEECH_BUBBLE) return <MessageCircle size={size} />;
  if (kind === TEXT) return <Type size={size} />;
  if (kind === SHAPE) return <Square size={size} />;
  if (kind === DRAWING) return <Pencil size={size} />;
  return null;
}

// The home page's paper colours (ProjectsPage's burst).
const YELLOW = "#f2c12e";
const RED = "#d9302a";
const GREEN = "#2a9d4a";
const BLUE = "#1e6fd0";

// Drawn on a 32 × 32 grid, outlined in the icon's colour (the ink).
const COLOURED: Record<string, React.ReactNode> = {
  // A yellow speech bubble, its tail down on the left, three dots of talk in it.
  [SPEECH_BUBBLE]: (
    <>
      <path d="M6 5h20a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H14l-6 6v-6H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" fill={YELLOW} />
      <circle cx="10.5" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // A big blue T, cut out.
  [TEXT]: <path d="M5 5h22v6.5h-7.5V27h-7V11.5H5Z" fill={BLUE} />,
  // A red circle, a blue square and a green triangle, overlapping.
  [SHAPE]: (
    <>
      <rect x="3.5" y="12" width="14" height="14" rx="1" fill={BLUE} />
      <circle cx="21" cy="19" r="7.5" fill={RED} />
      <path d="M15 3.5 23 15H7Z" fill={GREEN} />
    </>
  ),
};
