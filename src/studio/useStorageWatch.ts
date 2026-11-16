"use client";

import { useEffect } from "react";
import { ALMOST_FULL, estimateStorage } from "@/adapters/storage/storageInfo";
import { editorStore } from "@/store/useEditor";

// Warns once the device is past 80% full (step 21): when the studio opens, and after each
// picture (useCapture). Closing the warning keeps it closed until the studio opens again.
let warned = false;

export async function checkStorage(): Promise<void> {
  if (warned) return;
  const estimate = await estimateStorage();
  if (!estimate || estimate.ratio < ALMOST_FULL) return;
  warned = true;
  editorStore.getState().setStorageNotice("almost-full");
}

export function useStorageWatch() {
  useEffect(() => {
    warned = false;
    void checkStorage();
    return () => editorStore.getState().setStorageNotice(null);
  }, []);
}
