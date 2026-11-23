import { newId } from "./ids";
import { cloneElements, sameElements, type Element } from "./element";
import type { Adjust, Frame, Project, Transform } from "./types";

// Bump when the stored shape changes, together with a Dexie migration (step 06+)
// and an archive upgrade (step 27).
export const SCHEMA_VERSION = 1;

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;
export const MAX_WIDTH = 1920;
export const MAX_HEIGHT = 1080;

export const DEFAULT_FPS = 8;
export const MIN_FPS = 1;
export const MAX_FPS = 30;
export const FPS_OPTIONS = [5, 8, 10, 12, 15] as const;   // what the speed control offers

export const DEFAULT_TRANSFORM: Readonly<Transform> = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
export const DEFAULT_ADJUST: Readonly<Adjust> = Object.freeze({ brightness: 1, contrast: 1 });
// Brightness and contrast (step 20), as factors: 1 is the photo as taken. 50% to 150% is enough to
// rescue a dark or flat shot without turning it into a white or black page.
export const MIN_ADJUST = 0.5;
export const MAX_ADJUST = 1.5;

export const DEFAULT_NAME = "My animation";
export const MAX_NAME_LENGTH = 60;

// A project name as typed: spaces tidied, capped so it fits a card, never empty.
export function cleanName(name: string): string {
  const tidy = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
  return tidy || DEFAULT_NAME;
}

type ProjectOptions = { name?: string; width?: number; height?: number; fps?: number; now?: number };

export function createProject({ name = DEFAULT_NAME, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, fps = DEFAULT_FPS, now = Date.now() }: ProjectOptions = {}): Project {
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name: cleanName(name),
    width: evenSize(width, MAX_WIDTH),
    height: evenSize(height, MAX_HEIGHT),
    fps: clampFps(fps),
    frameIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

type FrameOptions = { hold?: number; transform?: Partial<Transform>; adjust?: Partial<Adjust>; elements?: Element[]; empty?: boolean };

export function createFrame(projectId: string, imageId: string, { hold = 1, transform, adjust, elements = [], empty = false }: FrameOptions = {}): Frame {
  return {
    id: newId(),
    projectId,
    imageId,
    hold: clampHold(hold),
    transform: { ...DEFAULT_TRANSFORM, ...transform },
    adjust: { ...DEFAULT_ADJUST, ...adjust },
    elements: cloneElements(elements),
    ...(empty ? { empty: true } : {}),
  };
}

// An exact copy with a new id: same picture (shared, not copied), same length, position,
// brightness and bubbles. Nested objects are copied, never shared, so moving the copy can't move the
// source. Every field added to Frame must be handled here; a test fails if a nested object
// is shared or a field goes missing.
export function cloneFrame(frame: Frame): Frame {
  return { ...frame, id: newId(), transform: { ...frame.transform }, adjust: { ...frame.adjust }, elements: cloneElements(frame.elements) };
}

// The safe zone's width: 0 (the whole picture is filmed) to 60 project px, whole pixels.
export const SAFE_MARGIN = 20;
export const MAX_SAFE_MARGIN = 60;

export function clampSafeMargin(margin: number): number {
  return Number.isFinite(margin) ? Math.min(MAX_SAFE_MARGIN, Math.max(0, Math.round(margin))) : SAFE_MARGIN;
}

// A project's safe zone, with the default for projects made before it could be set.
export function safeMargin(project: Pick<Project, "safeMargin">): number {
  return project.safeMargin === undefined ? SAFE_MARGIN : clampSafeMargin(project.safeMargin);
}

export function clampFps(fps: number): number {
  return Number.isFinite(fps) ? Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps))) : DEFAULT_FPS;
}

export function clampHold(hold: number): number {
  return Number.isFinite(hold) ? Math.max(1, Math.round(hold)) : 1;
}

// H.264 (step 26) needs even dimensions; also cap to the maximum working resolution.
function evenSize(size: number, max: number): number {
  const whole = Number.isFinite(size) ? Math.min(max, Math.max(2, Math.round(size))) : max;
  return whole - (whole % 2);
}

// Brightness and contrast kept between 50% and 150%, in steps of 1%; anything unreadable is 100%.
export function clampAdjust(adjust: Partial<Adjust>): Adjust {
  const keep = (value: number | undefined) => (Number.isFinite(value) ? Math.round(Math.min(MAX_ADJUST, Math.max(MIN_ADJUST, value!)) * 100) / 100 : 1);
  return { brightness: keep(adjust.brightness), contrast: keep(adjust.contrast) };
}

export function sameAdjust(a: Adjust, b: Adjust): boolean {
  return a.brightness === b.brightness && a.contrast === b.contrast;
}

// Whether two frames are the same in every detail, exactly (no rounding allowed): a frame read
// back from storage after a save that didn't touch it (step 31: the store keeps the one it has).
export function sameFrame(a: Frame, b: Frame): boolean {
  const ta = a.transform;
  const tb = b.transform;
  return a.id === b.id && a.projectId === b.projectId && a.imageId === b.imageId && a.hold === b.hold && Boolean(a.empty) === Boolean(b.empty)
    && ta.x === tb.x && ta.y === tb.y && ta.scale === tb.scale && ta.rotation === tb.rotation && ta.flipX === tb.flipX && ta.flipY === tb.flipY
    && sameAdjust(a.adjust, b.adjust) && sameElements(a.elements ?? [], b.elements ?? []);
}
