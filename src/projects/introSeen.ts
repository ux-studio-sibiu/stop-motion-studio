"use client";

import { useEffect } from "react";

// The home page's intro (HomeTitle) plays when the studio app is opened, not every time the home
// page shows: coming back to it from the studio, it's simply there. The studio leaves a note when
// it opens (useLeavingIntroSeen); the home page's next intro uses it up. In memory only, so a
// reload, or opening the app again, plays it again.
let cameFromStudio = false;

// In the studio: going home from here won't play the intro.
export function useLeavingIntroSeen(): void {
  useEffect(() => { cameFromStudio = true; }, []);
}

// For the intro: should it be skipped this time? (Read while rendering, so it doesn't use the note
// up: React may render twice. introPlayed does, once it's on the page.)
export const skipIntro = (): boolean => cameFromStudio;
export function introPlayed(): void { cameFromStudio = false; }
