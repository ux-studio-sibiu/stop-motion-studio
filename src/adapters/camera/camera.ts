// Webcam access through the browser's MediaDevices API. Plain functions, no React:
// the useCamera hook in studio/ owns the lifecycle, this file knows the browser rules.

export type CameraStatus =
  | "idle"          // not started (or stopped)
  | "asking"        // waiting for the permission prompt or the device
  | "live"          // stream running
  | "denied"        // the user or a policy blocked the camera
  | "no-camera"     // no camera, or it was unplugged
  | "busy"          // another app holds the camera
  | "insecure"      // page isn't https / localhost, so the API is hidden
  | "unsupported"   // browser has no getUserMedia
  | "error";

type Size = { width: number; height: number };

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

// Ask for the project's working size; the browser picks the closest mode the camera has.
// A remembered camera is requested with `exact`, so a missing one fails instead of silently
// opening another camera.
export function videoConstraints(deviceId: string | null, size: Size): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      width: { ideal: size.width },
      height: { ideal: size.height },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  };
}

export function openCamera(deviceId: string | null, size: Size): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(videoConstraints(deviceId, size));
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

// Labels are empty strings until camera permission is granted.
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!cameraSupported()) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId !== "");
}

// True when the browser already remembers a "yes" for this site, so the camera can start
// without a prompt. Unknown (no Permissions API, or "camera" not queryable) counts as no.
export async function cameraPermissionGranted(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({ name: "camera" as PermissionName });
    return result.state === "granted";
  } catch {
    return false;
  }
}

// getUserMedia rejects with a DOMException whose name says what went wrong.
export function cameraStatusFromError(error: unknown): CameraStatus {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    case "NotReadableError":
    case "AbortError":
      return "busy";
    default:
      return "error";
  }
}

// A remembered deviceId that no longer exists fails with one of these.
export function isMissingDevice(error: unknown): boolean {
  return cameraStatusFromError(error) === "no-camera";
}

export function unavailableStatus(): CameraStatus {
  return typeof window !== "undefined" && !window.isSecureContext ? "insecure" : "unsupported";
}
