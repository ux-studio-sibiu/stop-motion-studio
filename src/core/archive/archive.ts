import {
  bubbleProps, clampAdjust, clampFps, clampHold, clampSafeMargin, cleanName, cleanOverlay, cleanSoundClip, DRAWING, drawingProps, MAX_HEIGHT, MAX_WIDTH, newId,
  normaliseAngle, SCHEMA_VERSION, SHAPE, shapeProps, SPEECH_BUBBLE, TEXT, textProps,
  type Element, type ElementBox, type Frame, type Overlay, type Project, type SoundClip, type Transform,
} from "../model";

// The project archive (step 27): a backup of one animation as a .zip, `project.json` beside its
// pictures (`images/<id>.jpg`, the photos as stored). This file is the archive's format, which is
// the stable, public one: storage (Dexie) can change behind it, an archive made today must still
// open later. Only `version` changes the format, and readManifest upgrades older ones.
//
// Reading an archive trusts nothing in it: every value is checked and kept in range, unknown kinds
// of object are dropped, sizes are capped, and anything that doesn't add up rejects the whole
// archive (ArchiveError), so nothing half-restored is ever saved.

export const ARCHIVE_FORMAT = "stop-motion-studio";
export const ARCHIVE_VERSION = 1;
export const ARCHIVE_LIMITS = {
  pictures: 5000,           // frames in one animation
  objects: 200,             // objects on one picture
  overlays: 500,            // objects on the overlay track
  sounds: 500,              // sounds on the sound row
  strokes: 2000,            // lines in one drawing
  strokePoints: 20000,      // numbers in one line (x, y pairs)
  imageBytes: 25 * 1024 * 1024,        // one photo
  totalBytes: 1536 * 1024 * 1024,      // everything unpacked
} as const;

export type ArchiveImage = { id: string; file: string; width: number; height: number };
export type ArchiveFrame = { image: string; hold: number; transform: Transform; adjust: Frame["adjust"]; elements: Element[]; empty?: boolean };   // empty: a see-through picture
export type ArchiveManifest = {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  schemaVersion: number;    // the storage schema it was made from, for the record
  project: Pick<Project, "name" | "width" | "height" | "fps" | "safeMargin" | "createdAt" | "updatedAt"> & { overlays: Overlay[]; sounds?: SoundClip[] };
  frames: ArchiveFrame[];   // in animation order
  images: ArchiveImage[];
};

export const imageFile = (imageId: string) => `images/${imageId}.jpg`;

// The manifest for an animation: its frames in order, each with the picture it shows (several
// frames can share one), and each picture once.
export function archiveManifest(project: Project, frames: readonly Frame[], images: readonly { id: string; width: number; height: number }[]): ArchiveManifest {
  const byId = new Map(frames.map((frame) => [frame.id, frame]));
  const ordered = project.frameIds.flatMap((id) => byId.get(id) ?? []);
  const used = new Set(ordered.map((frame) => frame.imageId));
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    schemaVersion: project.schemaVersion,
    project: { name: project.name, width: project.width, height: project.height, fps: project.fps, safeMargin: project.safeMargin, overlays: project.overlays ?? [], sounds: project.sounds ?? [], createdAt: project.createdAt, updatedAt: project.updatedAt },
    frames: ordered.map((frame) => ({ image: frame.imageId, hold: frame.hold, transform: frame.transform, adjust: frame.adjust, elements: frame.elements ?? [], ...(frame.empty ? { empty: true } : {}) })),
    images: images.filter((image) => used.has(image.id)).map((image) => ({ ...image, file: imageFile(image.id) })),
  };
}

// Why an archive can't be restored, in words for the child (or the grown-up helping).
export type ArchiveProblem = "not-archive" | "newer" | "missing-pictures" | "too-big";
export const ARCHIVE_PROBLEMS: Readonly<Record<ArchiveProblem, string>> = {
  "not-archive": "That file isn't a backup of an animation.",
  newer: "That backup was made with a newer version of the studio. Update this one first.",
  "missing-pictures": "That backup is missing some of its pictures, so it can't be restored.",
  "too-big": "That backup is too big to restore here.",
};

export class ArchiveError extends Error {
  constructor(readonly problem: ArchiveProblem) {
    super(ARCHIVE_PROBLEMS[problem]);
    this.name = "ArchiveError";
  }
}

// What a restore saves: a new animation, with new ids for it, its frames and its pictures, so it
// never overwrites anything (restoring twice makes two). `images` says which file in the archive
// each new picture comes from.
export type RestoredArchive = { project: Project; frames: Frame[]; images: (ArchiveImage & { file: string })[] };

export function readManifest(raw: unknown, { files, now = Date.now(), makeId = newId }: { files: ReadonlySet<string>; now?: number; makeId?: () => string }): RestoredArchive {
  const manifest = record(raw);
  if (!manifest || manifest.format !== ARCHIVE_FORMAT || !Number.isInteger(manifest.version) || (manifest.version as number) < 1) throw new ArchiveError("not-archive");
  if ((manifest.version as number) > ARCHIVE_VERSION) throw new ArchiveError("newer");
  const stored = record(manifest.project);
  const frames = manifest.frames;
  const images = manifest.images;
  if (!stored || !Array.isArray(frames) || !Array.isArray(images)) throw new ArchiveError("not-archive");
  if (frames.length > ARCHIVE_LIMITS.pictures || images.length > ARCHIVE_LIMITS.pictures) throw new ArchiveError("too-big");

  // The pictures: each one listed, in the archive, once; a new id each.
  const pictures = new Map<string, ArchiveImage>();
  for (const item of images) {
    const image = record(item);
    if (!image || typeof image.id !== "string" || typeof image.file !== "string" || pictures.has(image.id)) throw new ArchiveError("not-archive");
    if (!files.has(image.file)) throw new ArchiveError("missing-pictures");
    pictures.set(image.id, { id: makeId(), file: image.file, width: size(image.width, MAX_WIDTH * 4), height: size(image.height, MAX_HEIGHT * 4) });
  }

  const id = makeId();
  const restoredFrames = frames.map((item): Frame => {
    const frame = record(item);
    if (!frame || typeof frame.image !== "string") throw new ArchiveError("not-archive");
    const picture = pictures.get(frame.image);
    if (!picture) throw new ArchiveError("missing-pictures");
    return {
      id: makeId(),
      projectId: id,
      imageId: picture.id,
      hold: clampHold(number(frame.hold, 1)),
      transform: cleanTransform(frame.transform),
      adjust: clampAdjust(record(frame.adjust) ?? {}),
      elements: list(frame.elements, ARCHIVE_LIMITS.objects).flatMap((element) => cleanElement(element) ?? []),
      ...(frame.empty === true ? { empty: true } : {}),
    };
  });

  const overlays = list(stored.overlays, ARCHIVE_LIMITS.overlays).flatMap((item): Overlay[] => {
    const overlay = record(item);
    const element = overlay && cleanElement(overlay.element);
    if (!overlay || !element) return [];
    return [cleanOverlay({ id: typeof overlay.id === "string" ? overlay.id : makeId(), track: 1, start: number(overlay.start, 0), length: number(overlay.length, 1), element })];
  });

  const sounds = list(stored.sounds, ARCHIVE_LIMITS.sounds).flatMap((item): SoundClip[] => {
    const clip = record(item);
    if (!clip || typeof clip.sound !== "string" || clip.sound === "") return [];
    return [cleanSoundClip({ id: typeof clip.id === "string" ? clip.id : makeId(), start: number(clip.start, 0), sound: clip.sound, volume: number(clip.volume, 1), length: typeof clip.length === "number" ? clip.length : undefined })];   // its own length, if it was given one
  });

  const project: Project = {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: cleanName(typeof stored.name === "string" ? stored.name : ""),
    width: evenSize(stored.width, MAX_WIDTH),
    height: evenSize(stored.height, MAX_HEIGHT),
    fps: clampFps(number(stored.fps, NaN)),
    ...(stored.safeMargin === undefined ? {} : { safeMargin: clampSafeMargin(number(stored.safeMargin, NaN)) }),
    frameIds: restoredFrames.map((frame) => frame.id),
    overlays,
    sounds,
    createdAt: Number.isFinite(stored.createdAt) ? (stored.createdAt as number) : now,
    updatedAt: now,   // restored now: it comes first in the list
  };
  const usedImages = new Set(restoredFrames.map((frame) => frame.imageId));
  return { project, frames: restoredFrames, images: [...pictures.values()].filter((image) => usedImages.has(image.id)) };
}

// The kinds of object this version knows, each read through its own settings reader (which keeps
// only what makes sense). A kind from a newer studio is left out.
const KINDS: Readonly<Record<string, (element: Pick<Element, "props">) => object>> = {
  [SPEECH_BUBBLE]: bubbleProps,
  [TEXT]: textProps,
  [SHAPE]: shapeProps,
  [DRAWING]: (element) => {
    const { strokes } = drawingProps(element);
    return { strokes: strokes.slice(0, ARCHIVE_LIMITS.strokes).filter((stroke) => stroke.points.length <= ARCHIVE_LIMITS.strokePoints) };
  },
};

function cleanElement(raw: unknown): Element | null {
  const element = record(raw);
  const read = element && typeof element.kind === "string" ? KINDS[element.kind] : undefined;
  const box = record(element?.box);
  if (!element || !read || !box) return null;
  const props = read({ props: record(element.props) ?? {} });
  const cleanBox: ElementBox = {
    x: clamp(number(box.x, 0), -2, 3),
    y: clamp(number(box.y, 0), -2, 3),
    width: clamp(number(box.width, 0.3), 0.01, 5),
    height: clamp(number(box.height, 0.3), 0.01, 5),
    rotation: normaliseAngle(number(box.rotation, 0)),
  };
  return { id: typeof element.id === "string" ? element.id : newId(), kind: element.kind as string, box: cleanBox, props: props as Record<string, unknown> };
}

function cleanTransform(raw: unknown): Transform {
  const transform = record(raw) ?? {};
  return {
    x: clamp(number(transform.x, 0), -2, 2),
    y: clamp(number(transform.y, 0), -2, 2),
    scale: clamp(number(transform.scale, 1), 0.05, 20),
    rotation: normaliseAngle(number(transform.rotation, 0)),
    flipX: transform.flipX === true,
    flipY: transform.flipY === true,
  } satisfies Transform;
}

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const number = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const size = (value: unknown, max: number) => Math.round(clamp(number(value, 1), 1, max));
function evenSize(value: unknown, max: number): number {
  const whole = Math.round(clamp(number(value, max), 2, max));
  return whole - (whole % 2);
}
