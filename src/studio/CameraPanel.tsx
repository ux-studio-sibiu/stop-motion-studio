import { Camera, Power } from "lucide-react";
import { useEditor } from "@/store/useEditor";
import type { Camera as CameraState } from "./useCamera";

// Side panel: which camera, on/off, the capture button and how many pictures there are.
export function CameraPanel({ camera, canCapture, onCapture, capturing }: { camera: CameraState; canCapture: boolean; onCapture: () => void; capturing: boolean }) {
  const live = camera.status === "live";
  const count = useEditor((state) => state.project?.frameIds.length ?? 0);

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

      <button type="button" className="big-button is-capture" aria-label="Take a picture" title="Take a picture (Space)" disabled={!canCapture} aria-busy={capturing} onClick={onCapture}><Camera size={40} /></button>
      <p className="picture-count" aria-live="polite">{count === 0 ? "No pictures yet" : count === 1 ? "1 picture" : `${count} pictures`}</p>
    </aside>
  );
}
