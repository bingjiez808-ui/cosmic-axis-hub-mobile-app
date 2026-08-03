/**
 * Resolve the canonical PUBLIC site URL for user-facing links (auth emails,
 * OAuth redirect_uri, sharing, canonical tags).
 *
 * Priority:
 *   1. Explicit env: VITE_PUBLIC_SITE_URL (client) / PUBLIC_SITE_URL (server)
 *   2. Current window.origin — ONLY if it looks like a real public host
 *   3. Stable public preview fallback: preview--cosmic-axis-hub.lovable.app
 *
 * Hosts that we must NEVER embed in a customer email:
 *   - id-preview--*.lovable.app   (the editor sandbox; requires Lovable login)
 *   - *.lovable.dev               (editor domain)
 *   - localhost / 127.0.0.1       (developer machine)
 *   - looks-alike hosts such as `id-preview--x.lovable.app.evil.com`
 *
 * When the runtime origin matches any of those, we fall back to the public
 * preview URL so the verification link resolves to the app the customer is
 * actually using — not the Lovable editor sign-in wall.
 */

// Stable public preview subdomain for this project. Immutable across renames.
export const PUBLIC_PREVIEW_URL = "https://preview--cosmic-axis-hub.lovable.app";

function readEnvUrl(): string | undefined {
  try {
    const viteVal =
      typeof import.meta !== "undefined" &&
      (import.meta as { env?: Record<string, string | undefined> }).env
        ? (import.meta as { env: Record<string, string | undefined> }).env
            .VITE_PUBLIC_SITE_URL
        : undefined;
    if (viteVal && /^https?:\/\//i.test(viteVal)) return stripTrailingSlash(viteVal);
  } catch {
    /* ignore */
  }
  try {
    if (typeof process !== "undefined" && process.env?.PUBLIC_SITE_URL) {
      const v = process.env.PUBLIC_SITE_URL;
      if (/^https?:\/\//i.test(v)) return stripTrailingSlash(v);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function stripTrailingSlash(u: string): string {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

/** True when the given host must NOT appear in a customer-facing email. */
export function isForbiddenAuthHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  // Editor domain
  if (h === "lovable.dev" || h.endsWith(".lovable.dev")) return true;
  // id-preview sandbox: must be *exactly* `id-preview--<id>.lovable.app`.
  // Anything ending in `.lovable.app` that starts with `id-preview--` is the
  // editor sandbox; reject to be safe. Look-alikes like `.lovable.app.evil.com`
  // don't end in `.lovable.app`, so they're rejected as forbidden too (safer
  // to fall back than to trust an unknown host with a session token).
  if (h.startsWith("id-preview--") && h.endsWith(".lovable.app")) return true;
  return false;
}

/**
 * Returns the base URL (no trailing slash) suitable for auth email links.
 */
export function getPublicSiteUrl(): string {
  const explicit = readEnvUrl();
  if (explicit) return explicit;

  if (typeof window !== "undefined" && window.location?.origin) {
    const { hostname, origin } = window.location;
    if (!isForbiddenAuthHost(hostname)) return stripTrailingSlash(origin);
  }
  return PUBLIC_PREVIEW_URL;
}

/**
 * Build a full auth redirect URL that always points at the app's own
 * /auth/callback route on a PUBLIC host, with an optional in-app `next` path.
 *
 * `next` MUST be a same-origin absolute path (starts with `/`, not `//`,
 * not `/\`). Anything else is dropped to prevent open redirects.
 */
export function getAuthRedirectUrl(next?: string): string {
  const base = getPublicSiteUrl();
  const safeNext =
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
      ? next
      : undefined;
  const q = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
  return `${base}/auth/callback${q}`;
}

/** Sanitize a `next` value pulled off a URL. Same rules as above. */
export function sanitizeNextPath(next: string | null | undefined): string | undefined {
  if (typeof next !== "string") return undefined;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return undefined;
  }
  return next;
}
