/**
 * useEntranceSequence — session gate + phase state machine for the
 * Destiny Library immersive entrance overlay.
 *
 * Phases:
 *   idle   → nothing rendered (SSR / decision pending)
 *   visible → overlay is shown, user can drive fog and enter
 *   exiting-enter → "推开馆门" pressed, full cinematic transition
 *   exiting-skip  → "跳过序幕" pressed, quick fade
 *   done   → overlay unmounted
 *
 * Gate: sessionStorage["destiny_library_entrance_seen_v1"].
 * Force replay via `?replayEntrance=1`.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type EntrancePhase = "idle" | "visible" | "exiting-enter" | "exiting-skip" | "done";

const STORAGE_KEY = "destiny_library_entrance_seen_v1";
const ENTER_DURATION = 1500;
const ENTER_DURATION_REDUCED = 300;
const SKIP_DURATION = 400;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useEntranceSequence() {
  const [phase, setPhase] = useState<EntrancePhase>("idle");
  const timerRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    let show = true;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("replayEntrance") === "1") {
        sessionStorage.removeItem(STORAGE_KEY);
        show = true;
      } else if (sessionStorage.getItem(STORAGE_KEY) === "true") {
        show = false;
      }
    } catch {
      /* private mode etc. — still show once */
    }
    setPhase(show ? "visible" : "done");
    return () => clearTimer();
  }, []);

  const markSeen = () => {
    try { sessionStorage.setItem(STORAGE_KEY, "true"); } catch { /* noop */ }
  };

  const enter = useCallback(() => {
    setPhase((prev) => (prev === "visible" ? "exiting-enter" : prev));
    markSeen();
    clearTimer();
    const dur = prefersReducedMotion() ? ENTER_DURATION_REDUCED : ENTER_DURATION;
    timerRef.current = window.setTimeout(() => setPhase("done"), dur);
  }, []);

  const skip = useCallback(() => {
    setPhase((prev) => (prev === "visible" ? "exiting-skip" : prev));
    markSeen();
    clearTimer();
    timerRef.current = window.setTimeout(() => setPhase("done"), SKIP_DURATION);
  }, []);

  return { phase, enter, skip };
}
