"use client";

import { useEffect, useRef } from "react";

// The live picture. Not mirrored: what you see is exactly what a capture will be.
// `onVideo` hands the element to the studio, so capturing can read the current frame.
export function CameraView({ stream, onVideo }: { stream: MediaStream; onVideo: (element: HTMLVideoElement | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;
    onVideo(element);
    return () => { element.srcObject = null; onVideo(null); };
  }, [stream, onVideo]);

  return <video ref={video} className="camera-video" autoPlay playsInline muted />;
}
