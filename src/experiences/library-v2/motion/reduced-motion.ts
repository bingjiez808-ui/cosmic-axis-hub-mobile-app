/**
 * Guided Library V2 · reduced-motion hook.
 *
 * Every animated component reads this hook and short-circuits its
 * transition when the OS-level preference is `reduce`. Also flips true
 * when the "?motion=off" search param is set, useful for E2E snapshots.
 */
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const forced = search.get("motion") === "off";
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () => setReduced(forced || mq.matches);
    compute();
    mq.addEventListener?.("change", compute);
    return () => mq.removeEventListener?.("change", compute);
  }, []);
  return reduced;
}
