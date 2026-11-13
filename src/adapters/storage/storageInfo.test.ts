import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateStorage, formatBytes, isStoragePersistent, requestPersistentStorage } from "@/adapters/storage/storageInfo";

afterEach(() => vi.unstubAllGlobals());

const withStorage = (storage: Partial<StorageManager> | undefined) => vi.stubGlobal("navigator", { storage });

describe("estimateStorage", () => {
  it("reports usage, quota and how full it is", async () => {
    withStorage({ estimate: async () => ({ usage: 50, quota: 200 }) });
    expect(await estimateStorage()).toEqual({ usage: 50, quota: 200, ratio: 0.25 });
  });

  it("says 'don't know' when the browser can't tell", async () => {
    withStorage(undefined);
    expect(await estimateStorage()).toBeNull();
    withStorage({ estimate: async () => ({ usage: 50 }) });
    expect(await estimateStorage()).toBeNull();
    withStorage({ estimate: async () => { throw new Error("nope"); } });
    expect(await estimateStorage()).toBeNull();
  });
});

describe("requestPersistentStorage", () => {
  it("doesn't ask again when storage is already persistent", async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persisted: async () => true, persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks, and passes on the browser's answer", async () => {
    withStorage({ persisted: async () => false, persist: async () => false });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("never throws, even without the API", async () => {
    withStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
    withStorage({ persisted: async () => { throw new Error("nope"); } });
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe("isStoragePersistent", () => {
  it("reports the browser's answer without asking for anything", async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persisted: async () => true, persist });
    expect(await isStoragePersistent()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("is false when the browser can't tell", async () => {
    withStorage(undefined);
    expect(await isStoragePersistent()).toBe(false);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [12 * 1024 * 1024, "12 MB"],
    [2.5 * 1024 ** 3, "2.5 GB"],
  ])("formats %d bytes as %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
