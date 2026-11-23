"use client";

import { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { burstSvg, type BurstShape } from "./cardboard-letters/cardboard-shape.js";

// A burst cut from cardboard, with a ring of coloured paper on it and the content (the title) in
// the middle: the cardboard letters font's (cardboard-shape.js, synced in; its look and the
// .nsc-cardboard-burst styles are there). The SVG is the font's markup as it is; its ids are this
// component's own, the same on the server and in the browser.
type Options = BurstShape & { edge?: number; paint?: string | readonly string[]; paintInset?: number; paintWidth?: number; cardboard?: boolean; pieces?: number; spread?: number; shownPieces?: number };
export function CardboardBurst({ className = "", style, children, ...options }: Options & { className?: string; style?: CSSProperties; children?: ReactNode }) {
  const id = `burst${useId().replace(/[^\w-]/g, "")}`;
  const key = JSON.stringify(options);
  const svg = useMemo(() => burstSvg({ ...(JSON.parse(key) as Options), bases: "/cardboard-letters/bases/", id }), [key, id]);

  return (
    <div className={`nsc-cardboard-burst ${className}`} style={{ ...style, aspectRatio: `${options.width} / ${options.height}` }}>
      <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="burst-content">{children}</div>
    </div>
  );
}
