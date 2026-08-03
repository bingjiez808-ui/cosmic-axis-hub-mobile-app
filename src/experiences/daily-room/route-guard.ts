/**
 * Route-level guard for the "today's reading room" preview routes:
 *   /me/home, /me/friends, /me/match
 *
 * Same host allow-list as the Guided Library V2 preview guard —
 * DEV, localhost, and id-preview--*.lovable.app only. Production
 * (fate-nexus-ai.lovable.app) is BLOCKED via redirect to `/`.
 *
 * Runs isomorphically. During SSR (no `window`) we allow the request
 * so the router can hydrate and then the client-side execution of
 * `beforeLoad` enforces the real check; this matches how the V2
 * preview guard is used from a route today.
 */
import { redirect } from "@tanstack/react-router";

import { isSocialPreviewAllowed } from "@/lib/social-gates";

export function ensureSocialPreviewAllowed(): void {
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) return;
  const hostname = window.location.hostname;
  const isDev =
    typeof import.meta !== "undefined" &&
    Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  if (!isSocialPreviewAllowed({ hostname, isDev })) {
    throw redirect({ to: "/" });
  }
}
