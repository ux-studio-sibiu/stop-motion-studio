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

// A laptop's own camera, by its name (the only hint browsers give): "Integrated Camera",
// "FaceTime HD Camera", "Built-in", a phone's front camera. Anything else counts as plugged in.
const BUILT_IN = /integrated|built-?in|facetime|internal|front|user[- ]facing/i;
export function isBuiltInCamera(label: string): boolean {
  return BUILT_IN.test(label);
}

// The plugged-in camera to switch to, if any: when the one in use (`currentId`; null or unknown
// when the browser picked it) is built in, or not known, and a camera that isn't built in is
// there. Null when the one in use is already a plugged-in camera, or there's no other.
// Without labels (before permission) nothing can be told apart: null.
export function preferredCamera(devices: readonly { deviceId: string; label: string }[], currentId: string | null): string | null {
  const current = devices.find((device) => device.deviceId === currentId);
  if (current && !isBuiltInCamera(current.label)) return null;
  return devices.find((device) => device.deviceId !== currentId && device.label !== "" && !isBuiltInCamera(device.label))?.deviceId ?? null;
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

// Locking the camera's automatic settings, for stop motion: a webcam keeps adjusting its focus,
// exposure and white balance as hands and light change between shots, which shows as flicker,
// colour shifts and focus pulsing in the animation. Locked, each one the camera can set by hand is
// set to manual at its current value; unlocked, back to automatic ("continuous"). Only what the
// camera reports it can do (MediaStreamTrack.getCapabilities: Chrome and Edge, some webcams).
export type CameraLock = { focus: boolean; exposure: boolean; whiteBalance: boolean };
export const NO_LOCK: CameraLock = { focus: false, exposure: false, whiteBalance: false };

// The settings involved, as the browser names them (not yet in TypeScript's own types).
type LockableTrack = Pick<MediaStreamTrack, "applyConstraints"> & {
  getCapabilities?: () => object;
  getSettings: () => object;
};
const SETTINGS = [
  { key: "focus", mode: "focusMode", value: "focusDistance" },
  { key: "exposure", mode: "exposureMode", value: "exposureTime" },
  { key: "whiteBalance", mode: "whiteBalanceMode", value: "colorTemperature" },
] as const;

// What this camera can lock: the settings it can switch to manual.
export function cameraLockSupport(track: LockableTrack | null | undefined): CameraLock {
  const capabilities = (track?.getCapabilities?.() ?? {}) as Record<string, unknown>;
  const can = (mode: string) => Array.isArray(capabilities[mode]) && (capabilities[mode] as unknown[]).includes("manual");
  return { focus: can("focusMode"), exposure: can("exposureMode"), whiteBalance: can("whiteBalanceMode") };
}

// Locks (or unlocks) what the camera can; returns what it locked (nothing when unlocking, or when
// the camera refused).
export async function setCameraLock(track: LockableTrack, locked: boolean): Promise<CameraLock> {
  const support = cameraLockSupport(track);
  const settings = track.getSettings() as Record<string, unknown>;
  const wanted: Record<string, unknown> = {};
  for (const { key, mode, value } of SETTINGS) {
    if (!support[key]) continue;
    wanted[mode] = locked ? "manual" : "continuous";
    if (locked && typeof settings[value] === "number") wanted[value] = settings[value];   // where it is now
  }
  if (Object.keys(wanted).length === 0) return NO_LOCK;
  try {
    await track.applyConstraints({ advanced: [wanted] } as MediaTrackConstraints);
  } catch {
    return NO_LOCK;   // the camera said no: as if it couldn't
  }
  return locked ? support : NO_LOCK;
}
