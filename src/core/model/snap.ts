import type { Point } from "./transform";

// Snapping a dragged picture into line (step 19): its left edge, centre or right edge to a nearby
// vertical line, and its top, middle or bottom to a nearby horizontal one. All in project pixels.
// Only drags snap; arrow-key nudges never do, so a nudge always moves exactly what it says.

export type Box = { left: number; top: number; right: number; bottom: number };
export type SnapLines = { x: readonly number[]; y: readonly number[] };   // vertical lines at x, horizontal at y
// How far to shift the box, and the lines it snapped to (null: none on that axis), to draw as guides.
export type Snap = { dx: number; dy: number; x: number | null; y: number | null };

export function snapBox(box: Box, lines: SnapLines, threshold: number): Snap {
  const x = nearest([box.left, (box.left + box.right) / 2, box.right], lines.x, threshold);
  const y = nearest([box.top, (box.top + box.bottom) / 2, box.bottom], lines.y, threshold);
  return { dx: x?.shift ?? 0, dy: y?.shift ?? 0, x: x?.line ?? null, y: y?.line ?? null };
}

// A box's own edges and centre, as lines another box can snap to.
export function boxLines(box: Box): SnapLines {
  return { x: [box.left, (box.left + box.right) / 2, box.right], y: [box.top, (box.top + box.bottom) / 2, box.bottom] };
}

// The smallest box around some points (a turned picture's corners).
export function boundsOf(points: readonly Point[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

function nearest(edges: readonly number[], lines: readonly number[], threshold: number): { line: number; shift: number } | null {
  let best: { line: number; shift: number } | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const shift = line - edge;
      if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { line, shift };
    }
  }
  return best;
}
