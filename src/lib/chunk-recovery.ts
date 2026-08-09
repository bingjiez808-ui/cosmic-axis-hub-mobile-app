/**
 * Recovery from stale client chunks.
 *
 * After a new build, a tab that is still holding the previous module graph
 * can fail with "Failed to fetch dynamically imported module". When that
 * happens the app never finishes hydrating: the page looks fine but every
 * button and link is inert. We reload once (guarded by sessionStorage so a
 * genuinely broken deploy cannot cause a reload loop) to pick up the fresh
 * module graph.
 */

const FLAG = "lod:chunk-reloaded";

const PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
];

function isChunkError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const m = message.toLowerCase();
  return PATTERNS.some((p) => m.includes(p));
}

function recover() {
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
  } catch {
    return;
  }
  window.location.reload();
}

export function installChunkRecovery(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    if (isChunkError(event.message)) recover();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as { message?: unknown } | string | undefined;
    const message = typeof reason === "string" ? reason : reason?.message;
    if (isChunkError(message)) recover();
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  // Clear the guard only after the app has stayed healthy for a while, so a
  // genuinely broken build cannot reload in a loop.
  const clear = window.setTimeout(() => {
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      /* noop */
    }
  }, 15_000);

  return () => {
    window.clearTimeout(clear);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
