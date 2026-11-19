import { describe, expect, it } from "vitest";
import { isHeic, isPhotoFile, PHOTO_LIMITS, photoNote, photoOrder, photoSize } from "./photos";

const none = { added: 0, heic: 0, broken: 0, tooBig: 0, notPhotos: 0, overLimit: 0 };

describe("photo import", () => {
  it("takes pictures by type, or by name when there's no type, and knows iPhone photos", () => {
    expect(isPhotoFile({ name: "a.jpg", type: "image/jpeg" })).toBe(true);
    expect(isPhotoFile({ name: "a", type: "image/png" })).toBe(true);
    expect(isPhotoFile({ name: "IMG_1.HEIC", type: "" })).toBe(true);
    expect(isPhotoFile({ name: "photo.webp", type: "" })).toBe(true);
    expect(isPhotoFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isPhotoFile({ name: "clip.mp4", type: "video/mp4" })).toBe(false);
    expect(isHeic({ name: "x.heif", type: "" })).toBe(true);
    expect(isHeic({ name: "x", type: "image/heic" })).toBe(true);
    expect(isHeic({ name: "x.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("orders photos by name, numbers counted as numbers", () => {
    const names = photoOrder([{ name: "IMG_10.jpg", type: "" }, { name: "img_9.jpg", type: "" }, { name: "IMG_100.jpg", type: "" }, { name: "IMG_2.jpg", type: "" }]).map((file) => file.name);
    expect(names).toEqual(["IMG_2.jpg", "img_9.jpg", "IMG_10.jpg", "IMG_100.jpg"]);
  });

  it("keeps a photo's shape, shrinking it to fit inside the animation and never enlarging it", () => {
    const inside = { width: 1280, height: 720 };
    expect(photoSize(4032, 3024, inside)).toEqual({ width: 960, height: 720 });     // 4:3 phone photo
    expect(photoSize(3024, 4032, inside)).toEqual({ width: 540, height: 720 });     // portrait
    expect(photoSize(3840, 2160, inside)).toEqual({ width: 1280, height: 720 });    // 4K, same shape
    expect(photoSize(5000, 1000, inside)).toEqual({ width: 1280, height: 256 });    // panorama
    expect(photoSize(640, 480, inside)).toEqual({ width: 640, height: 480 });       // small: as it is
    expect(photoSize(0, 480, inside)).toEqual({ width: 0, height: 0 });
  });

  it("says what was added and why any weren't", () => {
    expect(photoNote({ ...none, added: 1 })).toEqual({ text: "Added 1 photo.", problem: false });
    expect(photoNote({ ...none, added: 8 })).toEqual({ text: "Added 8 photos.", problem: false });
    const mixed = photoNote({ ...none, added: 5, heic: 2, broken: 1, notPhotos: 1 });
    expect(mixed.problem).toBe(true);
    expect(mixed.text).toBe("Added 5 photos. 2 photos from an iPhone (HEIC) can't be opened in this browser: save them as JPEG first. 1 photo couldn't be opened. 1 file wasn't a photo.");
    expect(photoNote({ ...none, notPhotos: 3 })).toEqual({ text: "No photos added. 3 files weren't photos.", problem: true });
    expect(photoNote({ ...none, added: PHOTO_LIMITS.files, overLimit: 4, tooBig: 1 }).text).toBe(`Added ${PHOTO_LIMITS.files} photos. 1 photo was too big. Only ${PHOTO_LIMITS.files} at a time: 4 photos left out.`);
  });
});
