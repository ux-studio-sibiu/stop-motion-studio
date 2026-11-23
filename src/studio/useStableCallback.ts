"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// A function that stays the same from render to render but always runs the latest version of
// `callback`: for handlers handed to memoised children (the timeline's pictures, step 31), which
// would otherwise all redraw whenever the parent does. Not for calling while rendering.
export function useStableCallback<A extends unknown[], R>(callback: (...args: A) => R): (...args: A) => R {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useCallback((...args: A) => latest.current(...args), []);
}
