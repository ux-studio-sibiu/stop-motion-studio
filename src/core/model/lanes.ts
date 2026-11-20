// Rows for the timeline's rows of bars in time (objects in time, step 24; sounds, step 29b), so
// overlapping bars don't hide each other: each goes in the first row that's free from its start,
// in order of start (then id, so it's always the same). A bar ending where another starts leaves
// the row free for it. By id.
export type Span = { id: string; start: number; end: number };   // ticks

export function timeLanes(spans: readonly Span[]): Record<string, number> {
  const lanes: Record<string, number> = {};
  const ends: number[] = [];   // where each row is free from
  for (const span of [...spans].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    let lane = ends.findIndex((end) => end <= span.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = span.end;
    lanes[span.id] = lane;
  }
  return lanes;
}

// How many rows those lanes need: at least one, so an empty row still shows.
export function laneCount(lanes: Readonly<Record<string, number>>): number {
  return Math.max(1, ...Object.values(lanes).map((lane) => lane + 1));
}
