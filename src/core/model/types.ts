import type { Element } from "./element";
import type { Overlay } from "./overlay";

// The animation data model (PLAN.md §3). Plain data: no classes, no methods, so it
// stores in IndexedDB, serialises to an archive and diffs for undo without conversion.

export type Project = {
  id: string;
  schemaVersion: number;
  name: string;
  width: number;           // working resolution in px; captures are resized to it
  height: number;
  fps: number;             // ticks per second; a frame lasts `hold` ticks
  // The band along every edge that the video leaves out, in project px (0-60). Missing in older
  // projects: SAFE_MARGIN (20) then. See safeMargin() and core/render/safeZone.ts.
  safeMargin?: number;
  frameIds: string[];      // the order of the animation
  // Objects that live in time (step 24), on the timeline's second track. Missing in older
  // projects: none then. Read it with overlaysOf().
  overlays?: Overlay[];
  createdAt: number;       // ms since epoch
  updatedAt: number;
};

// Position relative to the project: x / y are fractions of width / height (0.1 = 10% right),
// so a transform survives a change of working resolution.
export type Transform = {
  x: number;
  y: number;
  scale: number;           // 1 = fits the frame
  rotation: number;        // degrees, clockwise
  flipX: boolean;
  flipY: boolean;
};

// Non-destructive: the photo is never changed, these are applied when rendering. 1 = unchanged.
export type Adjust = {
  brightness: number;
  contrast: number;
};

export type Frame = {
  id: string;
  projectId: string;
  imageId: string;         // several frames may share one image (duplicate / hold)
  hold: number;            // whole ticks on screen, >= 1
  transform: Transform;
  adjust: Adjust;
  elements: Element[];     // speech bubbles and the like, on this picture only (step 23)
};

export type StoredImage = {
  id: string;
  projectId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
};

export type StoredThumb = {
  imageId: string;
  projectId: string;
  blob: Blob;
};
