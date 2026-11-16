import { Camera, Power } from "lucide-react";
import { useEditor } from "@/store/useEditor";
import type { Camera as CameraState } from "@/studio/useCamera";
import "./_camera.scss";

// When the camera can't start: a short line under the on/off button. (The stage says it at
// length while there are no pictures yet.)
const PROBLEMS: Partial<Record<CameraState["status"], string>> = {
  denied: "The camera is blocked. Allow it in the address bar.",
  "no-camera": "No camera found.",
  busy: "Another app is using the camera.",
  insecure: "The camera needs https:// or localhost.",
  unsupported: "This browser can't use a camera.",
  error: "Something went wrong with the camera.",
};

// The Camera tab of the side panel: which camera, on/off, the capture button and how many pictures there are.
export function CameraPanel({ camera, canCapture, onCapture, capturing }: { camera: CameraState; canCapture: boolean; onCapture: () => void; capturing: boolean }) {
  const live = camera.status === "live";
  const count = useEditor((state) => state.project?.frameIds.length ?? 0);

  return (
    <div className="camera-controls">
      {/* The main thing, centred in the space there is. */}
      <div className="capture-area">
        <button type="button" className="big-button is-capture" aria-label="Take a picture" title="Take a picture (Space)" disabled={!canCapture} aria-busy={capturing} onClick={onCapture}><Camera size={40} /></button>
        <p className="picture-count" aria-live="polite">{count === 0 ? "No pictures yet" : count === 1 ? "1 picture" : `${count} pictures`}</p>
      </div>

      {/* The camera's settings, at the bottom. */}
      <div className="camera-settings">
        {PROBLEMS[camera.status] && <p className="camera-problem" role="status">{PROBLEMS[camera.status]}</p>}
        {camera.devices.length > 1 && (
          <label className="camera-picker">
            <span>Which camera</span>
            <select value={camera.deviceId ?? ""} onChange={(event) => camera.selectDevice(event.target.value)}>
              {camera.deviceId === null && <option value="" disabled>Choose a camera</option>}
              {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="icon-button" onClick={live ? camera.stop : camera.start} aria-pressed={live}><Power size={24} />{live ? "Turn camera off" : "Turn camera on"}</button>
      </div>
    </div>
  );
}
