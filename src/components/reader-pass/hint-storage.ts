/**
 * Session-storage helper — remembers whether the "拖动借阅证" hint has
 * already been shown this browser session. Once the user drags or taps
 * the pass, or the 4.5s timer elapses, we set the flag and don't show
 * again until the tab is closed.
 */
const KEY = "reader_pass_hinted";

export function readHintSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markHintSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Ignore storage failures — the hint just re-renders next mount.
  }
}
