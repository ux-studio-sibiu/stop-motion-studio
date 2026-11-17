import { describe, expect, it } from "vitest";
import { fitText, wrapText } from "./text";

// Every character is 10 px wide at size 10, so widths are easy to count.
const measure = (text: string) => text.length * 10;
const measureAt = (text: string, size: number) => text.length * size;

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("Hello", 100, measure)).toEqual(["Hello"]);
  });

  it("wraps at spaces so no line is wider than the box", () => {
    expect(wrapText("I am a big dinosaur", 100, measure)).toEqual(["I am a big", "dinosaur"]);
  });

  it("keeps the child's own line breaks, and squeezes repeated spaces", () => {
    expect(wrapText("Hi\nthere   you", 100, measure)).toEqual(["Hi", "there you"]);
  });

  it("breaks a word too long for a whole line", () => {
    expect(wrapText("Aaaaaaaaaaaaaaa!", 100, measure)).toEqual(["Aaaaaaaaaa", "aaaaa!"]);
  });

  it("has no lines for empty text", () => {
    expect(wrapText("   ", 100, measure)).toEqual([]);
  });
});

describe("fitText", () => {
  it("uses the biggest size at which the text fits", () => {
    const fitted = fitText("Hi", { width: 200, height: 100 }, measureAt, { max: 60, min: 10 });
    expect(fitted).toEqual({ size: 60, lines: ["Hi"], lineHeight: 1.2 });
  });

  it("shrinks long text until it fits the box", () => {
    const fitted = fitText("one two three four", { width: 200, height: 100 }, measureAt, { max: 60, min: 10 });
    expect(fitted.lines.length * fitted.size * 1.2).toBeLessThanOrEqual(100);
    expect(fitted.lines.every((line) => measureAt(line, fitted.size) <= 200)).toBe(true);
    expect(fitted.size).toBeLessThan(60);
  });

  it("never goes below the minimum, even if the text then overflows", () => {
    const fitted = fitText("a very long sentence indeed that cannot ever fit", { width: 50, height: 20 }, measureAt, { max: 40, min: 12 });
    expect(fitted.size).toBe(12);
  });
});
