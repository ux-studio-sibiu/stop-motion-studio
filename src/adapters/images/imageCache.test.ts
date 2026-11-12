import { describe, expect, it } from "vitest";
import { createImageCache } from "@/adapters/images/imageCache";

describe("imageCache", () => {
  it("stores, returns and forgets blobs by image id", () => {
    const cache = createImageCache();
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    cache.put("i1", blob);
    expect(cache.get("i1")).toBe(blob);
    expect(cache.size).toBe(1);
    cache.delete("i1");
    expect(cache.get("i1")).toBeUndefined();
  });

  it("clears everything", () => {
    const cache = createImageCache();
    cache.put("i1", new Blob());
    cache.put("i2", new Blob());
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
