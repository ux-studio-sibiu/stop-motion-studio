import { SHAPE, SPEECH_BUBBLE, TEXT, type Element } from "../model";
import { drawBubble } from "./bubble";
import { drawShape, drawText } from "./shape";

// How each kind of object is drawn (step 23). A plain map from kind to drawing function: a new
// kind of object adds a line here. A kind that isn't known is skipped, never an error, so a
// project made with a newer studio still opens.
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Draw = (ctx: Ctx, element: Element, frame: { width: number; height: number }) => void;

const KINDS: Readonly<Record<string, Draw>> = {
  [SPEECH_BUBBLE]: drawBubble,
  [TEXT]: drawText,
  [SHAPE]: drawShape,
};

// A frame's objects, in order (later ones on top).
export function drawElements(ctx: Ctx, frame: { width: number; height: number }, elements: readonly Element[]): void {
  for (const element of elements) KINDS[element.kind]?.(ctx, element, frame);
}
