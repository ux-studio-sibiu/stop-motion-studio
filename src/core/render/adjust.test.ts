import { describe, expect, it } from "vitest";
import { adjustPixels, adjustTable } from "./adjust";

// The pixel fallback for brightness and contrast, in Node. That it matches the canvas filter is
// checked on a real canvas in renderer.browser.test.ts.

describe("adjustTable", () => {
  it("leaves pixels alone at 100%", () => {
    const table = adjustTable({ brightness: 1, contrast: 1 });
    expect([table[0], table[100], table[255]]).toEqual([0, 100, 255]);
  });

  it("brightness multiplies, up to white", () => {
    const table = adjustTable({ brightness: 1.5, contrast: 1 });
    expect([table[0], table[100], table[200]]).toEqual([0, 150, 255]);
  });

  it("contrast spreads values away from the middle", () => {
    const table = adjustTable({ brightness: 1, contrast: 1.5 });
    expect(table[128]).toBe(128);
    expect(table[64]).toBeLessThan(64);
    expect(table[192]).toBeGreaterThan(192);
    expect(adjustTable({ brightness: 1, contrast: 0.5 })[0]).toBe(64);   // less contrast: black turns grey
  });
});

describe("adjustPixels", () => {
  it("adjusts red, green and blue, never alpha", () => {
    const data = new Uint8ClampedArray([100, 50, 0, 128]);
    adjustPixels(data, { brightness: 1.5, contrast: 1 });
    expect([...data]).toEqual([150, 75, 0, 128]);
  });
});
