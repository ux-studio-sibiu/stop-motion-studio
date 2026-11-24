// A copy of the cardboard letters font's cardboard-shape.d.ts (casedeschise/fonts/cardboard letters/). Made by
// scripts/sync-cardboard-letters.mjs: change the font's, then run npm run sync:cardboard (don't edit this copy).

// Types for cardboard-shape.js (cardboard pieces of any outline, drawn in SVG).

export type Point = { x: number; y: number };

export type BurstShape = { width: number; height: number; spikes?: number; depth?: number; seed?: number; wobble?: number };

export function burstPoints(shape: BurstShape): Point[];
export function inset(points: readonly Point[], distance: number | ((outward: Point) => number)): Point[];
export function offset(points: readonly Point[], distance: number | ((outward: Point) => number)): Point[];
export function cardboardPiece(points: readonly Point[], options: { edge: number; surfaceId: string; id: string; bases: string }): string;
export function edgeShowing(outward: Point, least?: number): number;
export function toPath(points: readonly Point[]): string;
export function burstSvg(options: BurstShape & { edge?: number; paint?: string | readonly string[] | null; paintInset?: number; paintWidth?: number; bases?: string; id?: string; cardboard?: boolean; pieces?: number; spread?: number; shownPieces?: number; margin?: number; paperReach?: number }): string;
