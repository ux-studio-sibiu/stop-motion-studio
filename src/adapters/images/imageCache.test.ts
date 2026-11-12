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

  it("makes one object URL per image and replaces it when the image changes", () => {
    const cache = createImageCache();
    cache.put("i1", new Blob(["a"]));
    const first = cache.url("i1");
    expect(first).toMatch(/^blob:/);
    expect(cache.url("i1")).toBe(first);
    cache.put("i1", new Blob(["b"]));
    expect(cache.url("i1")).not.toBe(first);
    expect(cache.url("missing")).toBeUndefined();
  });

  it("revokes URLs when images are deleted or cleared", () => {
    const cache = createImageCache();
    const revoked: string[] = [];
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => { revoked.push(url); original(url); };
    try {
      cache.put("i1", new Blob(["a"]));
      cache.put("i2", new Blob(["b"]));
      const one = cache.url("i1")!, two = cache.url("i2")!;
      cache.delete("i1");
      cache.clear();
      expect(revoked).toEqual([one, two]);
    } finally {
      URL.revokeObjectURL = original;
    }
  });

  it("clears everything", () => {
    const cache = createImageCache();
    cache.put("i1", new Blob());
    cache.put("i2", new Blob());
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
