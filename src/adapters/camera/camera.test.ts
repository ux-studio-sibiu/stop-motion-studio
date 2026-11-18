import { describe, expect, it } from "vitest";
import { cameraStatusFromError, isBuiltInCamera, isMissingDevice, preferredCamera, videoConstraints } from "@/adapters/camera/camera";

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
