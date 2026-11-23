import { describe, expect, it } from "vitest";
import { cameraLockSupport, cameraStatusFromError, isBuiltInCamera, isMissingDevice, NO_LOCK, preferredCamera, setCameraLock, videoConstraints } from "@/adapters/camera/camera";

describe("cameraStatusFromError", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["NotReadableError", "busy"],
    ["AbortError", "busy"],
    ["TypeError", "error"],
  ])("maps %s to %s", (name, status) => {
    expect(cameraStatusFromError(new DOMException("x", name))).toBe(status);
  });

  it("treats anything that isn't an error as a generic error", () => {
    expect(cameraStatusFromError("nope")).toBe("error");
    expect(cameraStatusFromError(undefined)).toBe("error");
  });

  it("knows which errors mean the remembered camera is gone", () => {
    expect(isMissingDevice(new DOMException("x", "OverconstrainedError"))).toBe(true);
    expect(isMissingDevice(new DOMException("x", "NotAllowedError"))).toBe(false);
  });
});

describe("videoConstraints", () => {
  const size = { width: 1280, height: 720 };

  it("asks for the working size, no audio, any camera", () => {
    expect(videoConstraints(null, size)).toEqual({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
  });

  it("asks for a remembered camera exactly", () => {
    const video = videoConstraints("cam-2", size).video as MediaTrackConstraints;
    expect(video.deviceId).toEqual({ exact: "cam-2" });
  });
});

describe("preferring a plugged-in camera", () => {
  const laptop = { deviceId: "laptop", label: "Integrated Camera (04f2:b6dd)" };
  const usb = { deviceId: "usb", label: "HD Pro Webcam C920" };
  const mac = { deviceId: "mac", label: "FaceTime HD Camera" };

  it("tells a laptop's own camera by its name", () => {
    expect(["Integrated Camera", "FaceTime HD Camera (Built-in)", "Front Camera", "Integrated Webcam"].map(isBuiltInCamera)).toEqual([true, true, true, true]);
    expect(["HD Pro Webcam C920", "USB Camera", "Logitech BRIO", "OBS Virtual Camera"].map(isBuiltInCamera)).toEqual([false, false, false, false]);
  });

  it("switches from the built-in camera, or one the browser picked, to a plugged-in one", () => {
    expect(preferredCamera([laptop, usb], "laptop")).toBe("usb");
    expect(preferredCamera([mac, usb], null)).toBe("usb");
    expect(preferredCamera([laptop, usb], "gone")).toBe("usb");
  });

  it("stays when a plugged-in camera is in use, or there's no other", () => {
    expect(preferredCamera([laptop, usb], "usb")).toBeNull();
    expect(preferredCamera([laptop, mac], "laptop")).toBeNull();
    expect(preferredCamera([laptop], "laptop")).toBeNull();
  });

  it("can't tell cameras apart without their names (before permission)", () => {
    expect(preferredCamera([{ deviceId: "a", label: "" }, { deviceId: "b", label: "" }], "a")).toBeNull();
  });
});

// A camera track as the lock sees it: what it can do, where it is now, and the constraints applied.
function fakeTrack(capabilities: Record<string, unknown> | null, settings: Record<string, unknown> = {}, refuse = false) {
  const applied: unknown[] = [];
  return {
    applied,
    getCapabilities: capabilities ? () => capabilities : undefined,
    getSettings: () => settings,
    applyConstraints: async (constraints?: MediaTrackConstraints) => { if (refuse) throw new Error("OverconstrainedError"); applied.push(constraints); },
  };
}

describe("locking the camera's focus, exposure and white balance", () => {
  const all = { focusMode: ["continuous", "manual"], exposureMode: ["continuous", "manual"], whiteBalanceMode: ["continuous", "manual"] };

  it("knows what a camera can lock: the settings it can set by hand", () => {
    expect(cameraLockSupport(fakeTrack(all))).toEqual({ focus: true, exposure: true, whiteBalance: true });
    expect(cameraLockSupport(fakeTrack({ focusMode: ["continuous"], exposureMode: ["continuous", "manual"] }))).toEqual({ focus: false, exposure: true, whiteBalance: false });
    expect(cameraLockSupport(fakeTrack(null))).toEqual(NO_LOCK);   // a browser without getCapabilities
    expect(cameraLockSupport(null)).toEqual(NO_LOCK);
  });

  it("locks what it can at the current values", async () => {
    const track = fakeTrack(all, { focusDistance: 0.3, exposureTime: 120, colorTemperature: 4500 });
    expect(await setCameraLock(track, true)).toEqual({ focus: true, exposure: true, whiteBalance: true });
    expect(track.applied).toEqual([{ advanced: [{ focusMode: "manual", focusDistance: 0.3, exposureMode: "manual", exposureTime: 120, whiteBalanceMode: "manual", colorTemperature: 4500 }] }]);
  });

  it("locks only what the camera supports", async () => {
    const track = fakeTrack({ exposureMode: ["continuous", "manual"] }, { exposureTime: 80, focusDistance: 1 });
    expect(await setCameraLock(track, true)).toEqual({ focus: false, exposure: true, whiteBalance: false });
    expect(track.applied).toEqual([{ advanced: [{ exposureMode: "manual", exposureTime: 80 }] }]);
  });

  it("unlocks back to automatic", async () => {
    const track = fakeTrack(all, { focusDistance: 0.3 });
    expect(await setCameraLock(track, false)).toEqual(NO_LOCK);
    expect(track.applied).toEqual([{ advanced: [{ focusMode: "continuous", exposureMode: "continuous", whiteBalanceMode: "continuous" }] }]);
  });

  it("does nothing on a camera that can't lock, and reports nothing locked when the camera refuses", async () => {
    const none = fakeTrack({ focusMode: ["continuous"] });
    expect(await setCameraLock(none, true)).toEqual(NO_LOCK);
    expect(none.applied).toEqual([]);
    expect(await setCameraLock(fakeTrack(all, {}, true), true)).toEqual(NO_LOCK);
  });
});
