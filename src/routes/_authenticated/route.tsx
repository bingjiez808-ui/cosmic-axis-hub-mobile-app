import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

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

/**
 * Client-only gate for signed-in routes.
 * `ssr: false` is required because Supabase persists the session in
 * localStorage, which the server cannot read.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let data: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"] | null = null;
    let error: unknown = null;
    try {
      const res = await supabase.auth.getUser();
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }
    // Genuine network / refresh failure — surface a recoverable error rather
    // than bouncing to /auth (which would erase the session the user still
    // holds). Redirects only happen when Supabase confirms there is no user.
    if (error && isRetryableFetchError(error)) {
      throw new AuthRefreshFailedError(error);
    }
    if (error || !data?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    return { userId: data.user.id };
  },
  component: () => <Outlet />,
});
