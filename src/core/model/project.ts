import { newId } from "./ids";
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

type FrameOptions = { hold?: number; transform?: Partial<Transform>; adjust?: Partial<Adjust> };

export function createFrame(projectId: string, imageId: string, { hold = 1, transform, adjust }: FrameOptions = {}): Frame {
  return {
    id: newId(),
    projectId,
    imageId,
    hold: clampHold(hold),
    transform: { ...DEFAULT_TRANSFORM, ...transform },
    adjust: { ...DEFAULT_ADJUST, ...adjust },
  };
}

// An exact copy with a new id: same picture (shared, not copied), same length, position and
// brightness. Nested objects are copied, never shared, so moving the copy can't move the
// source. Every field added to Frame must be handled here; a test fails if a nested object
// is shared or a field goes missing.
export function cloneFrame(frame: Frame): Frame {
  return { ...frame, id: newId(), transform: { ...frame.transform }, adjust: { ...frame.adjust } };
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
