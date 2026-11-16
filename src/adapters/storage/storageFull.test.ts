import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { isStorageFull } from "./storageFull";

describe("isStorageFull", () => {
  it("recognises the browser's quota error, also inside Dexie's errors", () => {
    expect(isStorageFull(new DOMException("full", "QuotaExceededError"))).toBe(true);
    expect(isStorageFull(new Dexie.QuotaExceededError("full"))).toBe(true);
    expect(isStorageFull(new Dexie.AbortError("aborted", new DOMException("full", "QuotaExceededError")))).toBe(true);
    expect(isStorageFull({ code: 22 })).toBe(true);   // old Safari
  });

  it("isn't fooled by other errors", () => {
    expect(isStorageFull(new Error("nope"))).toBe(false);
    expect(isStorageFull(new Dexie.AbortError("aborted"))).toBe(false);
    expect(isStorageFull(undefined)).toBe(false);
  });
});
