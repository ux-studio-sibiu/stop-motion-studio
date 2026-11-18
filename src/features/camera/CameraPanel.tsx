import { Camera, ChevronDown, Power } from "lucide-react";
import { useEditor } from "@/store/useEditor";
import { useDropdown } from "@/studio/useDropdown";
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

// The Camera tab of the side panel: the capture button and how many pictures there are; at the
// bottom, on/off, joined to an arrow that lists the cameras when there's more than one (like
// See-through and its options).
export function CameraPanel({ camera, canCapture, onCapture, capturing }: { camera: CameraState; canCapture: boolean; onCapture: () => void; capturing: boolean }) {
  const live = camera.status === "live";
  const count = useEditor((state) => state.project?.frameIds.length ?? 0);
  const { open: choosing, toggle: toggleCameras, ref: menu } = useDropdown();
  const many = camera.devices.length > 1;

  return (
    <div className="camera-controls">
      {/* The main thing, centred in the space there is. */}
      <div className="capture-area">
        <button type="button" className="big-button is-capture" aria-label="Take a picture" title="Take a picture (Space or Tab)" disabled={!canCapture} aria-busy={capturing} onClick={onCapture}><Camera size={40} /></button>
        <p className="picture-count" aria-live="polite">{count === 0 ? "No pictures yet" : count === 1 ? "1 picture" : `${count} pictures`}</p>
      </div>

      {/* The camera's settings, at the bottom. */}
      <div className="camera-settings">
        {PROBLEMS[camera.status] && <p className="camera-problem" role="status">{PROBLEMS[camera.status]}</p>}
        <div ref={menu} className="nsc-camera-switch option-menu">
          <button type="button" className={`icon-button toggle${live ? " is-on" : ""}`} onClick={live ? camera.stop : camera.start} aria-pressed={live}><Power size={24} />{live ? "Turn camera off" : "Turn camera on"}</button>
          {many && <button type="button" className={`icon-button more${live ? " is-on" : ""}`} aria-label="Choose a camera" aria-expanded={choosing} aria-haspopup="true" onClick={toggleCameras}><ChevronDown size={20} /></button>}
          {many && choosing && (
            <div className="options" role="group" aria-label="Cameras">
              {camera.devices.map((device, index) => {
                const on = device.deviceId === camera.deviceId;
                return <button key={device.deviceId} type="button" className={`icon-button camera-option${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => { toggleCameras(); camera.selectDevice(device.deviceId); }}>{device.label || `Camera ${index + 1}`}</button>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
