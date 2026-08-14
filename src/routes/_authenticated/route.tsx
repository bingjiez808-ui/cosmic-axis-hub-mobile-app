import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { DailyRoomPending, DailyRoomError } from "@/experiences/daily-room/fallback";


/**
 * Recoverable auth error surfaced by the root `errorComponent`. We
 * distinguish "no session" (silent redirect to /auth) from a real network /
 * refresh failure — the latter must NOT redirect silently, because the user
 * still holds a valid local session and re-signing-in cannot help. The
 * root errorComponent renders a "Try again" affordance for these.
 */
export class AuthRefreshFailedError extends Error {
  cause: unknown;
  constructor(cause: unknown) {
    super(
      cause instanceof Error
        ? `Authentication refresh failed: ${cause.message}`
        : "Authentication refresh failed",
    );
    this.name = "AuthRefreshFailedError";
    this.cause = cause;
  }
}

function isRetryableFetchError(err: unknown): boolean {
  if (!err) return false;
  // supabase-js emits `AuthRetryableFetchError` for network / DNS failures.
  const name =
    (err as { name?: unknown }).name && typeof (err as { name?: unknown }).name === "string"
      ? ((err as { name: string }).name as string)
      : "";
  if (name === "AuthRetryableFetchError" || name === "TypeError") return true;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return /fetch|network|failed to fetch|load failed/i.test(msg);
}

const AUTH_SESSION_TIMEOUT_MS = 2800;

function hasLocalAuthHint() {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(window.localStorage).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
  } catch {
    return false;
  }
}

async function getSessionWithTimeout() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timeoutId = setTimeout(() => resolve("timeout"), AUTH_SESSION_TIMEOUT_MS);
    });
    return await Promise.race([supabase.auth.getSession(), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Client-only gate for signed-in routes.
 * `ssr: false` is required because Supabase persists the session in
 * localStorage, which the server cannot read.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: DailyRoomPending,
  errorComponent: DailyRoomError,
  // Use `getSession()` — a *local* localStorage read — instead of
  // `getUser()`, which does a network call to /auth/v1/user and blocks
  // the entire authenticated subtree behind DailyRoomPending for seconds.
  // The session token is verified by the server on every subsequent
  // request; we only need to confirm the user has a local session before
  // rendering the frame. Component-level effects can re-verify.
  beforeLoad: async ({ location }) => {
    let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null = null;
    let error: unknown = null;
    let timedOutWithoutLocalSession = false;
    try {
      const res = await getSessionWithTimeout();
      if (res === "timeout") {
        if (hasLocalAuthHint()) return { userId: null, authCheckTimedOut: true };
        timedOutWithoutLocalSession = true;
      } else {
        session = res.data.session;
        error = res.error;
      }
    } catch (e) {
      error = e;
    }
    if (timedOutWithoutLocalSession) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    if (error && isRetryableFetchError(error)) {
      throw new AuthRefreshFailedError(error);
    }
    if (!session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    return { userId: session.user.id };
  },
  component: () => <Outlet />,
});
