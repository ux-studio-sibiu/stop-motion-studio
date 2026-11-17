// Text in a box (step 23). Canvas text doesn't wrap, so the renderer breaks it into lines here,
// and picks the largest font size, down to a readable minimum, at which they fit. `measure` gives a
// string's width in px (ctx.measureText in the renderer, a stand-in in tests).

export type Measure = (text: string) => number;

// Lines no wider than `maxWidth`: words wrap at spaces, the child's own line breaks are kept, and a
// word too long for a whole line is broken where it has to be.
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      line = "";
      // The word alone: if it still doesn't fit, break it into pieces that do.
      let rest = word;
      while (measure(rest) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return text.trim() === "" ? [] : lines;
}

export type FittedText = { size: number; lines: string[]; lineHeight: number };

// The largest whole font size from `max` down to `min` at which the wrapped lines fit the box. At
// `min` it stops shrinking (a bubble stays readable), even if the text no longer fits.
export function fitText(text: string, box: { width: number; height: number }, measureAt: (text: string, size: number) => number, { max, min, lineHeight = 1.2 }: { max: number; min: number; lineHeight?: number }): FittedText {
  const top = Math.max(1, Math.floor(max));
  const bottom = Math.max(1, Math.min(top, Math.floor(min)));
  for (let size = top; size > bottom; size--) {
    const lines = wrapText(text, box.width, (piece) => measureAt(piece, size));
    if (lines.length * size * lineHeight <= box.height) return { size, lines, lineHeight };
  }
  return { size: bottom, lines: wrapText(text, box.width, (piece) => measureAt(piece, bottom)), lineHeight };
}
