"use client";

import { MessageCircle, Square, Type } from "lucide-react";
import { SHAPE, SPEECH_BUBBLE, TEXT } from "@/core/model";

// Each kind of object's icon, the same in the Objects tab's tiles and on the timeline's overlay
// bars. A new kind adds a line; an unknown kind has none.
export function ObjectIcon({ kind, size = 24 }: { kind: string; size?: number }) {
  if (kind === SPEECH_BUBBLE) return <MessageCircle size={size} />;
  if (kind === TEXT) return <Type size={size} />;
  if (kind === SHAPE) return <Square size={size} />;
  return null;
}
