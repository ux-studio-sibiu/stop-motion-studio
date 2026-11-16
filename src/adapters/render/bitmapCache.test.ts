import { describe, expect, it } from "vitest";
import { createBitmapCache } from "@/adapters/render/bitmapCache";

// Fake bitmaps that remember being closed, and a fake store of photos.
function setup(limit = 3) {
  const closed: string[] = [];
  const decoded: string[] = [];
  const cache = createBitmapCache({
    limit,
    fetch: async (id) => (id === "missing" ? undefined : new Blob([id])),
    decode: async (blob) => {
      const id = await blob.text();
      decoded.push(id);
      return { id, width: 160, height: 90, close: () => closed.push(id) };
    },
  });
  return { cache, closed, decoded };
}

describe("bitmap cache", () => {
  it("decodes a picture on demand and then has it straight away", async () => {
    const { cache } = setup();
    expect(cache.get("a")).toBeUndefined();
    const bitmap = await cache.load("a");
    expect(bitmap).toMatchObject({ id: "a" });
    expect(cache.get("a")).toBe(bitmap);
  });

  it("decodes a picture once, even when asked twice at the same time", async () => {
    const { cache, decoded } = setup();
    const [first, second] = await Promise.all([cache.load("a"), cache.load("a")]);
    expect(first).toBe(second);
    await cache.load("a");
    expect(decoded).toEqual(["a"]);
  });

  it("keeps only the most recently used pictures, closing the ones it drops", async () => {
    const { cache, closed } = setup(3);
    for (const id of ["a", "b", "c"]) await cache.load(id);
    cache.get("a");   // used again: now the newest
    await cache.load("d");
    expect(closed).toEqual(["b"]);
    expect([cache.has("a"), cache.has("b"), cache.has("c"), cache.has("d")]).toEqual([true, false, true, true]);
    expect(cache.size).toBe(3);
  });

  it("gives nothing for a picture that isn't stored", async () => {
    const { cache } = setup();
    expect(await cache.load("missing")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("closes everything on clear, including a decode that finishes afterwards", async () => {
    const { cache, closed } = setup();
    await cache.load("a");
    const late = cache.load("b");
    cache.clear();
    expect(await late).toBeUndefined();
    expect(closed.sort()).toEqual(["a", "b"]);
    expect(cache.size).toBe(0);
  });

  it("closes a deleted picture", async () => {
    const { cache, closed } = setup();
    await cache.load("a");
    cache.delete("a");
    expect(closed).toEqual(["a"]);
    expect(cache.get("a")).toBeUndefined();
  });
});
