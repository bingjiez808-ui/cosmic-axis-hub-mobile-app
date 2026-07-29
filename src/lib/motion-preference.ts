/**
 * Motion preference — three-state store persisted in localStorage.
 *
 *   "auto"   → follow prefers-reduced-motion + low-end device heuristics
 *   "smooth" → force full smooth-scroll + card stacking animations
 *   "stable" → force reduced/stable mode: no Lenis, no transforms, no
 *              floating card stacking. Cards render as a plain vertical
 *              list. Fixes flicker/jitter on weak GPUs and low-power mobile.
 *
 * `useMotionMode()` collapses the setting to a boolean: `stable === true`
 * when the user picked stable, or when auto + reduced-motion / low-end
 * hardware is detected.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

export type MotionSetting = "auto" | "smooth" | "stable";

const STORAGE_KEY = "destiny-library:motion-preference";
const listeners = new Set<() => void>();

function read(): MotionSetting {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "smooth" || v === "stable" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function setMotionSetting(next: MotionSetting) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMotionSetting(): MotionSetting {
  return useSyncExternalStore(
    subscribe,
    read,
    () => "auto" as MotionSetting
  );
}

/** Best-effort low-end detection: RAM, cores, Save-Data hint. */
function detectLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (n.connection?.saveData) return true;
  if (typeof n.deviceMemory === "number" && n.deviceMemory > 0 && n.deviceMemory <= 3) return true;
  if (
    typeof n.hardwareConcurrency === "number" &&
    n.hardwareConcurrency > 0 &&
    n.hardwareConcurrency <= 3
  )
    return true;
  return false;
}

/**
 * Resolve the user's setting into a boolean stable flag.
 * SSR always returns `stable: false` so the smooth path can hydrate.
 * After mount the auto-detected value swaps in.
 */
export function useStableMotion(): { stable: boolean; setting: MotionSetting } {
  const setting = useMotionSetting();
  const [autoStable, setAutoStable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () => setAutoStable(mql.matches || detectLowEnd());
    compute();
    mql.addEventListener?.("change", compute);
    return () => mql.removeEventListener?.("change", compute);
  }, []);

  const stable =
    setting === "stable" ? true : setting === "smooth" ? false : autoStable;

  return { stable, setting };
}
