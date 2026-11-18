"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraPermissionGranted, cameraStatusFromError, cameraSupported, isMissingDevice, listCameras, openCamera, preferredCamera, stopStream, unavailableStatus, type CameraStatus } from "@/adapters/camera/camera";
import { remembered } from "./remembered";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "@/core/model";

export type Camera = {
  status: CameraStatus;
  settled: boolean;   // the first start is decided: running, failed, or waiting for the button
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  start: () => void;
  stop: () => void;
  selectDevice: (deviceId: string) => void;
};

const SIZE = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };   // the project's size once projects load (step 07)

function readDevice(): string | null {
  return remembered.cameraDevice.read() ?? null;
}

function saveDevice(deviceId: string | null): void {
  remembered.cameraDevice.save(deviceId || null);
}

// Owns the webcam for the studio. Every open gets a request number; when a newer request,
// a stop or an unmount happens first, the late stream is stopped instead of shown. That's
// what keeps React Strict Mode's double mount (and fast camera switching) from leaving a
// second stream running with the camera light on.
// A plugged-in camera wins over a laptop's own (preferredCamera): the first time, when no camera
// is remembered, and whenever one is plugged in while the camera is on. One the child picked is
// remembered and kept after that.
//
// The camera belongs to the Camera tab (`inUse`: that tab is open). Opening the tab turns it on;
// leaving it pauses it (off, light out, but not "turned off": that's only the child's own button,
// remembered so a reload keeps it off). On load it starts by itself only in the Camera tab, when
// the browser already allows it and the child didn't turn it off. From a blocked or missing camera
// opening the tab asks nothing: Try again does.
export function useCamera(inUse: boolean): Camera {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [checked, setChecked] = useState(false);   // knows whether to start by itself
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const request = useRef(0);
  const current = useRef<MediaStream | null>(null);
  const wanted = useRef(false);           // the child turned the camera on (resume after the tab is hidden)
  const chosen = useRef<string | null>(null);
  const reopen = useRef<(id: string) => void>(() => {});   // open, for a switch decided inside it
  const inUseNow = useRef(inUse);
  const statusNow = useRef(status);
  useEffect(() => { statusNow.current = status; }, [status]);

  const release = useCallback(() => {
    request.current++;
    stopStream(current.current);
    current.current = null;
    setStream(null);
  }, []);

  const open = useCallback(async (id: string | null) => {
    release();
    const mine = request.current;
    if (!cameraSupported()) { setStatus(unavailableStatus()); return; }
    setStatus("asking");

    try {
      const next = await openCamera(id, SIZE).catch((error) => {
        if (!id || !isMissingDevice(error) || mine !== request.current) throw error;
        saveDevice(null);   // the remembered camera is gone: take any camera instead
        return openCamera(null, SIZE);
      });
      if (mine !== request.current) { stopStream(next); return; }

      const track = next.getVideoTracks()[0];
      const actual = track?.getSettings().deviceId ?? id;
      track?.addEventListener("ended", () => {
        if (current.current !== next) return;
        release();
        setStatus("no-camera");   // unplugged, or the OS took it away
      });

      current.current = next;
      chosen.current = actual;
      saveDevice(actual);
      setStream(next);
      setDeviceId(actual);
      setStatus("live");
      const list = await listCameras();   // labels are only filled in after permission
      if (mine !== request.current) return;
      setDevices(list);
      const better = id ? null : preferredCamera(list, actual);   // nothing remembered: the browser picked
      if (better) reopen.current(better);
    } catch (error) {
      if (mine !== request.current) return;
      setStatus(cameraStatusFromError(error));
    }
  }, [release]);
  useEffect(() => { reopen.current = (id) => void open(id); }, [open]);

  // Turning the camera on or off is remembered on this device, so a reload keeps it that way.
  const start = useCallback(() => { wanted.current = true; remembered.cameraOff.save(null); void open(chosen.current); }, [open]);

  const stop = useCallback(() => { wanted.current = false; remembered.cameraOff.save(true); release(); setStatus("idle"); }, [release]);

  const selectDevice = useCallback((id: string) => { wanted.current = true; void open(id); }, [open]);

  // Leaving the Camera tab: off, but not remembered as turned off.
  const pause = useCallback(() => {
    if (!current.current && statusNow.current !== "asking") return;
    wanted.current = false;
    release();
    setStatus("idle");
  }, [release]);

  // The tab changed: on for the Camera tab (from off only), paused for any other.
  useEffect(() => {
    if (inUseNow.current === inUse) return;
    inUseNow.current = inUse;
    if (!inUse) pause();
    else if (statusNow.current === "idle") start();
  }, [inUse, pause, start]);

  useEffect(() => {
    chosen.current = readDevice();
    let active = true;

    // A camera plugged in while the camera is on takes over, if it's better (preferredCamera).
    let known: Set<string> | null = null;
    const refreshDevices = () => {
      void listCameras().then((list) => {
        if (!active) return;
        const added = known ? list.filter((device) => !known!.has(device.deviceId)) : [];
        known = new Set(list.map((device) => device.deviceId));
        setDevices(list);
        const better = current.current ? preferredCamera(list, chosen.current) : null;
        if (better && added.some((device) => device.deviceId === better)) void open(better);
      });
    };
    refreshDevices();

    // Start straight away only in the Camera tab, when the browser already allowed the camera and
    // the child didn't turn it off last time; otherwise wait for the button (or the tab), so a
    // permission prompt follows a tap.
    const turnedOff = remembered.cameraOff.read() === true;
    void cameraPermissionGranted().then((granted) => {
      if (!active) return;
      setChecked(true);
      if (granted && !turnedOff && inUseNow.current) start();   // "asking" in the same render, so not settled yet
    });

    // Turn the camera (and its light) off while the tab is hidden, back on when it returns.
    const onVisibility = () => {
      if (document.hidden) { release(); if (wanted.current) setStatus("idle"); }
      else if (wanted.current) void open(chosen.current);
    };

    navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [open, release, start]);

  return { status, settled: checked && status !== "asking", stream, devices, deviceId, start, stop, selectDevice };
}
