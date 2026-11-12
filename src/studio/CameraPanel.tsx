import { Camera, Power } from "lucide-react";
import type { Camera as CameraState } from "./useCamera";

// Side panel: which camera, on/off, and the capture button (capturing arrives in step 05).
export function CameraPanel({ camera }: { camera: CameraState }) {
  const live = camera.status === "live";

  return (
    <aside className="side-panel" aria-label="Camera">
      <h2 className="panel-title">Camera</h2>

      {camera.devices.length > 1 && (
        <label className="camera-picker">
          <span>Which camera</span>
          <select value={camera.deviceId ?? ""} onChange={(event) => camera.selectDevice(event.target.value)}>
            {camera.deviceId === null && <option value="" disabled>Choose a camera</option>}
            {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
          </select>
        </label>
      )}

      <button type="button" className="icon-button" onClick={live ? camera.stop : camera.start} aria-pressed={live}><Power size={24} />{live ? "Camera off" : "Camera on"}</button>

      <button type="button" className="big-button is-capture" aria-label="Take a picture" disabled><Camera size={40} /></button>
    </aside>
  );
}
