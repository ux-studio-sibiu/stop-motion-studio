import { describe, expect, it } from "vitest";
import { exportRect, projectExportRect, SAFE_MARGIN } from "@/core/render";

const shape = ({ width, height }: { width: number; height: number }) => width / height;

describe("exportRect", () => {
  it("takes the margin off the short sides and as large a share off the long ones: the picture's own shape, centred", () => {
    expect(SAFE_MARGIN).toBe(20);
    const rect = exportRect({ width: 1280, height: 720 });
    expect(rect).toEqual({ x: 36, y: 20, width: 1208, height: 680 });
    expect(Math.abs(shape(rect) - 16 / 9)).toBeLessThan(2 / 680);   // 16:9, to within the even-pixel rounding
  });

  it("keeps the shape of a tall picture too, the margin then on its left and right", () => {
    const rect = exportRect({ width: 720, height: 1280 }, 20);
    expect(rect).toEqual({ x: 20, y: 36, width: 680, height: 1208 });
  });

  it("keeps the size even, inside the line", () => {
    const rect = exportRect({ width: 1281, height: 721 });
    expect(rect.width % 2).toBe(0);
    expect(rect.height % 2).toBe(0);
    expect(rect.x).toBeGreaterThanOrEqual(20);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1281 - 20);
    expect(rect.y + rect.height).toBeLessThanOrEqual(721 - 20);
  });

  it("never eats the whole picture on a tiny project, and allows no margin at all", () => {
    expect(exportRect({ width: 30, height: 20 })).toEqual({ x: 14, y: 9, width: 2, height: 2 });
    expect(exportRect({ width: 1280, height: 720 }, 0)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });

  it("for an animation, uses its own safe zone, or the default when it has none", () => {
    expect(projectExportRect({ width: 1280, height: 720, safeMargin: 0 })).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(projectExportRect({ width: 1280, height: 720 })).toEqual(exportRect({ width: 1280, height: 720 }));
  });
});
