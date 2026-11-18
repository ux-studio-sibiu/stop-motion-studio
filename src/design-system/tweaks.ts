"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TOKENS, type Token } from "./tokens";

// The tokens as the design page has them now (D3): a scheme (light or dark, which one is shown and
// tuned), and tweaks on top of the list's values, per scheme. Applied as custom properties on the
// page's root, so every specimen follows at once; taken off again when the page goes, so the
// studio never sees them.
// The tweaks are kept in the browser (D4), under the page's own key, until Reset all.

export type Scheme = "light" | "dark";
export type Tweaks = Record<Scheme, Record<string, string>>;

const EMPTY: Tweaks = { light: {}, dark: {} };
const KEY = "stop-motion-studio:design-system-tweaks";   // the page's own key: nothing else in the app reads it

// The kept tweaks, as an external store: read once and cached (the same object until it changes,
// as useSyncExternalStore needs), saved on every change, and anything odd in storage ignored.
let kept: Tweaks | null = null;
const listeners = new Set<() => void>();
function readKept(): Tweaks {
  if (kept) return kept;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const part = (value: unknown) => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {}).filter(([name, v]) => TOKENS.some((t) => t.name === name) && typeof v === "string")) as Record<string, string>;
    kept = raw ? { light: part(raw.light), dark: part(raw.dark) } : EMPTY;
  } catch { kept = EMPTY; }
  return kept;
}
function writeKept(next: Tweaks): void {
  kept = next;
  try {
    if (Object.keys(next.light).length || Object.keys(next.dark).length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the tweaks still work, until a reload */ }
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

// A token's value in a scheme, before tweaks.
export function baseValue(token: Token, scheme: Scheme): string {
  return scheme === "dark" ? (token.dark ?? token.light) : token.light;
}

// Every token's value now: the scheme's base value, or its tweak.
export function currentValues(scheme: Scheme, tweaks: Tweaks): Record<string, string> {
  return Object.fromEntries(TOKENS.map((token) => [token.name, tweaks[scheme][token.name] ?? baseValue(token, scheme)]));
}

export function useTokenTweaks() {
  // The system's scheme until one is picked in the panel (light on the server, so the two agree).
  const system = useSyncExternalStore(onSchemeChange, systemScheme, () => "light" as Scheme);
  const [picked, setScheme] = useState<Scheme | null>(null);
  const scheme = picked ?? system;
  const tweaks = useSyncExternalStore(subscribe, readKept, () => EMPTY);
  const setTweaks = (change: (all: Tweaks) => Tweaks) => writeKept(change(readKept()));
  const values = useMemo(() => currentValues(scheme, tweaks), [scheme, tweaks]);

  // On the page's root while the page is open: the tokens, and the scheme for native controls.
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value);
    root.style.colorScheme = scheme;
    return () => {
      for (const name of Object.keys(values)) root.style.removeProperty(name);
      root.style.removeProperty("color-scheme");
    };
  }, [values, scheme]);

  const set = (name: string, value: string) => setTweaks((all) => {
    const token = TOKENS.find((item) => item.name === name);
    const mine = { ...all[scheme] };
    if (!token || value === baseValue(token, scheme)) delete mine[name]; else mine[name] = value;   // back to its value: not a tweak
    return { ...all, [scheme]: mine };
  });
  const reset = (name: string) => setTweaks((all) => { const mine = { ...all[scheme] }; delete mine[name]; return { ...all, [scheme]: mine }; });
  const resetAll = () => writeKept(EMPTY);

  return { scheme, setScheme, tweaks, values, set, reset, resetAll };
}

const DARK = "(prefers-color-scheme: dark)";
const systemScheme = (): Scheme => (matchMedia(DARK).matches ? "dark" : "light");
const onSchemeChange = (listener: () => void) => { const query = matchMedia(DARK); query.addEventListener("change", listener); return () => query.removeEventListener("change", listener); };

// The values the page shows now, for the gallery's token cards.
export const TokenValues = createContext<Record<string, string>>({});
export const useTokenValue = (name: string) => useContext(TokenValues)[name] ?? "";
