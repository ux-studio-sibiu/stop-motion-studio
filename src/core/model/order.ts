import type { Frame } from "./types";

// Brings a project's order back in line with the frames that really exist. Normally they
// always match (they're written in one transaction), but a crash, an old import or a bug
// could leave an id pointing at nothing, or a frame no id points at. Repairing on load means
// the timeline never shows a hole, and no picture is ever lost from it.
//   - ids without a frame are dropped
//   - an id listed twice is kept once, at its first place
//   - frames missing from the order are added at the end
export function repairFrameOrder(frameIds: readonly string[], frames: readonly Pick<Frame, "id">[]): string[] {
  const existing = new Set(frames.map((frame) => frame.id));
  const seen = new Set<string>();
  const repaired: string[] = [];

  for (const id of frameIds) {
    if (!existing.has(id) || seen.has(id)) continue;
    seen.add(id);
    repaired.push(id);
  }
  for (const frame of frames) {
    if (!seen.has(frame.id)) { seen.add(frame.id); repaired.push(frame.id); }
  }
  return repaired;
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
