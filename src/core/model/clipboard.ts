import { cloneElements, type Element } from "./element";
import { mergeDrawings } from "./drawing";
import { newId } from "./ids";
import { DRAWING } from "./objectKinds";
import type { Size } from "./transform";

// Copying an object to paste it onto other pictures (Ctrl+C, Ctrl+V). What's copied is the object
// as it is, with nothing shared; each paste is a new object in the same place, so something
// carried to the next picture doesn't need lining up again.

export function copyOf(element: Element): Element {
  return cloneElements([element])[0];
}

// A picture's objects with a copy pasted in, and the pasted object (to pick it). A drawing pasted
// onto a picture that has one already joins it: one drawing per picture.
export function pasteInto(elements: readonly Element[], copied: Element, size: Size): { elements: Element[]; pasted: Element } {
  const drawing = copied.kind === DRAWING ? elements.find((element) => element.kind === DRAWING) : undefined;
  if (drawing) {
    const pasted = mergeDrawings(drawing, copied, size);
    return { elements: elements.map((element) => (element.id === drawing.id ? pasted : element)), pasted };
  }
  const pasted = { ...copyOf(copied), id: newId() };
  return { elements: [...elements, pasted], pasted };
}
