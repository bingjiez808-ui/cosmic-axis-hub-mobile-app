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
 * FPS watchdog — non-disruptive frame-drop detector.
 *
 * Runs a lightweight rAF loop that samples FPS in 1s windows. If the device
 * sustains poor frame rates (3 consecutive windows under `sustainedFps`, or a
 * single window under `hardFloor`), it calls `onLowFps()` once and stops.
 *
 * Ignores the first 1.5s (warm-up + hydration cost) and any window while the
 * tab is hidden. Never mutates persisted settings, so the user's explicit
 * "smooth" choice is respected — this only nudges the in-memory `autoStable`
 * signal so cards stop floating this session.
 */
function startFpsWatchdog(onLowFps: () => void, opts?: {
  sustainedFps?: number;
  hardFloor?: number;
  windowMs?: number;
  requiredWindows?: number;
  warmUpMs?: number;
}): () => void {
  if (typeof window === "undefined") return () => {};
  const sustainedFps = opts?.sustainedFps ?? 40;
  const hardFloor = opts?.hardFloor ?? 24;
  const windowMs = opts?.windowMs ?? 1000;
  const requiredWindows = opts?.requiredWindows ?? 3;
  const warmUpMs = opts?.warmUpMs ?? 1500;

  let raf = 0;
  let started = 0;
  let windowStart = 0;
  let frames = 0;
  let poorWindows = 0;
  let stopped = false;

  const tick = (t: number) => {
    if (stopped) return;
    if (!started) {
      started = t;
      windowStart = t;
    }
    frames++;
    const elapsed = t - windowStart;
    if (elapsed >= windowMs) {
      const fps = (frames * 1000) / elapsed;
      // Skip warm-up window and any hidden-tab window (rAF is throttled → false low).
      const warmingUp = t - started < warmUpMs;
      if (!warmingUp && !document.hidden) {
        if (fps < hardFloor) {
          trigger();
          return;
        }
        if (fps < sustainedFps) {
          poorWindows++;
          if (poorWindows >= requiredWindows) {
            trigger();
            return;
          }
        } else {
          poorWindows = 0;
        }
      }
      frames = 0;
      windowStart = t;
    }
    raf = requestAnimationFrame(tick);
  };

  const trigger = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    try { onLowFps(); } catch { /* ignore */ }
  };

  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

const SESSION_FPS_FLAG = "destiny-library:auto-stable-fps";

/**
 * Resolve the user's setting into a boolean stable flag.
 * SSR always returns `stable: false` so the smooth path can hydrate.
 * After mount the auto-detected value swaps in — from reduced-motion,
 * low-end hardware heuristics, or the live FPS watchdog.
 */
export function useStableMotion(): { stable: boolean; setting: MotionSetting } {
  const setting = useMotionSetting();
  const [autoStable, setAutoStable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let fpsTripped = false;
    try {
      fpsTripped = window.sessionStorage.getItem(SESSION_FPS_FLAG) === "1";
    } catch { /* ignore */ }
    const compute = () => setAutoStable(mql.matches || detectLowEnd() || fpsTripped);
    compute();
    mql.addEventListener?.("change", compute);
    return () => mql.removeEventListener?.("change", compute);
  }, []);

  // Only watch FPS when the user is in "auto" AND we're currently running the
  // smooth path. If they're already stable (explicit or auto-detected), nothing
  // to downgrade.
  const currentlyStable =
    setting === "stable" ? true : setting === "smooth" ? false : autoStable;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (setting !== "auto" || currentlyStable) return;
    let flagged = false;
    try {
      flagged = window.sessionStorage.getItem(SESSION_FPS_FLAG) === "1";
    } catch { /* ignore */ }
    if (flagged) return;

    const stop = startFpsWatchdog(() => {
      try { window.sessionStorage.setItem(SESSION_FPS_FLAG, "1"); } catch { /* ignore */ }
      setAutoStable(true);
    });
    return stop;
  }, [setting, currentlyStable]);

  return { stable: currentlyStable, setting };
}

