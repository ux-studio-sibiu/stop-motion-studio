import { describe, expect, it } from "vitest";
import { cameraStatusFromError, isMissingDevice, videoConstraints } from "@/adapters/camera/camera";

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
