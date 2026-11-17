import { newId } from "./ids";
import type { Element } from "./element";
import type { Point } from "./transform";

// The kinds of object and their settings (steps 23-24). Each kind has a create function (a new
// one with its defaults) and a props reader that reads what's stored defensively: anything can be
// in storage, and objects saved before a setting existed get its default.
//   speech-bubble  speech, thought or spiked, with a tail and text
//   text           text on its own, with an optional background
//   shape          a rectangle, an ellipse or an arrow

export const SPEECH_BUBBLE = "speech-bubble";

// A speech bubble's settings:
//   variant    its shape: speech (rounded, pointed tail), thought (oval, little circles), spiked (a shout)
//   tail       the point the tail reaches, in fractions of the box (so it moves and turns with the
//              bubble); it can lie outside the box, and usually does
//   showTail   whether it has a tail (the point, or a thought bubble's little circles) at all
//   textSize   how big the text is at most; it still shrinks to fit the bubble
//   font       one of BUBBLE_FONTS
//   outline    how thick the outline is, or none
//   textColour, fill, outlineColour: #rrggbb
export type BubbleVariant = "speech" | "thought" | "spiked";
export type TextSize = "small" | "medium" | "large" | "huge";
export type OutlineWidth = "none" | "thin" | "medium" | "thick";
export type BubbleProps = { text: string; variant: BubbleVariant; tail: Point; showTail: boolean; textSize: TextSize; font: string; textColour: string; fill: string; outline: OutlineWidth; outlineColour: string };

export const BUBBLE_VARIANTS: readonly BubbleVariant[] = ["speech", "thought", "spiked"];
export const TEXT_SIZES: readonly TextSize[] = ["small", "medium", "large", "huge"];
export const OUTLINE_WIDTHS: readonly OutlineWidth[] = ["none", "thin", "medium", "thick"];

// The fonts a bubble can use: `family` is a CSS font-family list, for the canvas and the panel.
// Nunito is the app's own, self-hosted font; the others are fonts most computers already have,
// with a generic fallback where they don't.
export type BubbleFont = { id: string; label: string; family: string; weight: number };
export const BUBBLE_FONTS: readonly BubbleFont[] = [
  { id: "rounded", label: "Rounded", family: '"Nunito", "Nunito Fallback", sans-serif', weight: 700 },
  { id: "chunky", label: "Chunky", family: '"Nunito", "Nunito Fallback", sans-serif', weight: 1000 },
  { id: "comic", label: "Comic", family: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive', weight: 700 },
  { id: "classic", label: "Classic", family: 'Georgia, "Times New Roman", serif', weight: 700 },
  { id: "typewriter", label: "Typewriter", family: '"Courier New", Courier, monospace', weight: 700 },
];
export function bubbleFont(id: string): BubbleFont {
  return BUBBLE_FONTS.find((font) => font.id === id) ?? BUBBLE_FONTS[0];
}

export const BUBBLE_DEFAULTS: Omit<BubbleProps, "text" | "variant"> = { tail: { x: 0.25, y: 1.45 }, showTail: true, textSize: "medium", font: "rounded", textColour: "#1f2433", fill: "#ffffff", outline: "medium", outlineColour: "#1f2433" };

// A new bubble near the top of the frame, its tail pointing down and to the left.
export function createBubble(variant: BubbleVariant = "speech", text = ""): Element {
  return { id: newId(), kind: SPEECH_BUBBLE, box: { x: 0.3, y: 0.08, width: 0.4, height: 0.24, rotation: 0 }, props: { ...structuredClone(BUBBLE_DEFAULTS), text, variant } };
}

// A bubble's settings, whatever is stored (anything can be in storage, and bubbles from step 23
// have only text, variant and tail): unknown or missing values get the defaults.
export function bubbleProps(element: Pick<Element, "props">): BubbleProps {
  const { text, variant, tail, showTail, textSize, font, textColour, fill, outline, outlineColour } = element.props as Partial<BubbleProps>;
  const point = tail && Number.isFinite(tail.x) && Number.isFinite(tail.y) ? { x: tail.x, y: tail.y } : { ...BUBBLE_DEFAULTS.tail };
  return {
    text: typeof text === "string" ? text : "",
    variant: BUBBLE_VARIANTS.includes(variant!) ? variant! : "speech",
    tail: point,
    showTail: typeof showTail === "boolean" ? showTail : BUBBLE_DEFAULTS.showTail,
    textSize: TEXT_SIZES.includes(textSize!) ? textSize! : BUBBLE_DEFAULTS.textSize,
    font: bubbleFont(typeof font === "string" ? font : "").id,
    textColour: isColour(textColour) ? textColour : BUBBLE_DEFAULTS.textColour,
    fill: isColour(fill) ? fill : BUBBLE_DEFAULTS.fill,
    outline: OUTLINE_WIDTHS.includes(outline!) ? outline! : BUBBLE_DEFAULTS.outline,
    outlineColour: isColour(outlineColour) ? outlineColour : BUBBLE_DEFAULTS.outlineColour,
  };
}

function isColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

// Colours are #rrggbb. A fill can also be "none": see-through.
export const NO_FILL = "none";
function isFill(value: unknown): value is string {
  return value === NO_FILL || isColour(value);
}

// Text on its own (step 24): wrapped and fitted in its box like a bubble's, on an optional
// background (`fill`, "none" by default).
export const TEXT = "text";
export type TextProps = { text: string; textSize: TextSize; font: string; textColour: string; fill: string };
export const TEXT_DEFAULTS: TextProps = { text: "", textSize: "large", font: "chunky", textColour: "#ffffff", fill: NO_FILL };

export function createText(text = ""): Element {
  return { id: newId(), kind: TEXT, box: { x: 0.2, y: 0.4, width: 0.6, height: 0.2, rotation: 0 }, props: { ...TEXT_DEFAULTS, text } };
}

export function textProps(element: Pick<Element, "props">): TextProps {
  const { text, textSize, font, textColour, fill } = element.props as Partial<TextProps>;
  return {
    text: typeof text === "string" ? text : "",
    textSize: TEXT_SIZES.includes(textSize!) ? textSize! : TEXT_DEFAULTS.textSize,
    font: BUBBLE_FONTS.some((known) => known.id === font) ? font! : TEXT_DEFAULTS.font,
    textColour: isColour(textColour) ? textColour : TEXT_DEFAULTS.textColour,
    fill: isFill(fill) ? fill : TEXT_DEFAULTS.fill,
  };
}

// A shape (step 24): one kind, its form a setting, so a rectangle can become an arrow. The arrow
// points right across its box; turning the box points it anywhere.
export const SHAPE = "shape";
export type ShapeForm = "rectangle" | "ellipse" | "arrow";
export const SHAPE_FORMS: readonly ShapeForm[] = ["rectangle", "ellipse", "arrow"];
export type ShapeProps = { form: ShapeForm; fill: string; outline: OutlineWidth; outlineColour: string };
export const SHAPE_DEFAULTS: ShapeProps = { form: "rectangle", fill: "#fff3a3", outline: "medium", outlineColour: "#1f2433" };

export function createShape(form: ShapeForm = "rectangle"): Element {
  const box = form === "arrow" ? { x: 0.35, y: 0.42, width: 0.3, height: 0.16, rotation: 0 } : { x: 0.38, y: 0.33, width: 0.24, height: 0.34, rotation: 0 };
  return { id: newId(), kind: SHAPE, box, props: { ...SHAPE_DEFAULTS, form } };
}

export function shapeProps(element: Pick<Element, "props">): ShapeProps {
  const { form, fill, outline, outlineColour } = element.props as Partial<ShapeProps>;
  return {
    form: SHAPE_FORMS.includes(form!) ? form! : SHAPE_DEFAULTS.form,
    fill: isFill(fill) ? fill : SHAPE_DEFAULTS.fill,
    outline: OUTLINE_WIDTHS.includes(outline!) ? outline! : SHAPE_DEFAULTS.outline,
    outlineColour: isColour(outlineColour) ? outlineColour : SHAPE_DEFAULTS.outlineColour,
  };
}

// What an object is called in undo labels, buttons and the timeline: "speech bubble", "text",
// "arrow"... A kind this studio doesn't know is "object".
export function objectLabel(element: Pick<Element, "kind" | "props">): string {
  if (element.kind === SPEECH_BUBBLE) return { speech: "speech bubble", thought: "thought bubble", spiked: "spiked bubble" }[bubbleProps(element).variant];
  if (element.kind === TEXT) return "text";
  if (element.kind === SHAPE) return shapeProps(element).form;
  return "object";
}

// An object's text (trimmed), or "" for kinds without text: what the timeline shows on its bar.
export function objectText(element: Pick<Element, "kind" | "props">): string {
  if (element.kind === SPEECH_BUBBLE) return bubbleProps(element).text.trim();
  if (element.kind === TEXT) return textProps(element).text.trim();
  return "";
}

// Whether an object has text the Objects tab can type into.
export function hasText(element: Pick<Element, "kind">): boolean {
  return element.kind === SPEECH_BUBBLE || element.kind === TEXT;
}
