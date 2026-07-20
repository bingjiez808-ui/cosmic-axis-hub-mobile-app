/**
 * Pure guard for the Guided Library V2 preview route.
 *
 * Allowed environments:
 *   - Local dev  (Vite `import.meta.env.DEV` is true)
 *   - Localhost / 127.0.0.1 / ::1 (any port)
 *   - Lovable id-preview builds: hostname starts with `id-preview--` AND
 *     ends with `.lovable.app`
 *
 * Explicitly blocked:
 *   - The production Lovable subdomain (fate-nexus-ai.lovable.app)
 *   - Any other `*.lovable.app` host that is not an id-preview build
 *   - Look-alike hosts such as `id-preview--x.lovable.app.evil.com`
 *
 * The function is pure so it can be unit-tested without a DOM.
 */
export interface GuidedLibraryV2GuardInput {
  hostname: string;
  isDev: boolean;
}

export function isGuidedLibraryV2PreviewAllowed(
  input: GuidedLibraryV2GuardInput,
): boolean {
  const { hostname, isDev } = input;
  if (isDev) return true;
  if (typeof hostname !== "string" || hostname.length === 0) return false;

  const host = hostname.toLowerCase().trim();

  // Local hosts (any port).
  if (host === "localhost") return true;
  if (host === "127.0.0.1") return true;
  if (host === "::1") return true;
  if (host === "[::1]") return true;

  // Lovable id-preview builds only.
  // Require BOTH: starts with "id-preview--" AND ends with ".lovable.app".
  // Blocks fate-nexus-ai.lovable.app, generic lovable.app, and
  // look-alikes like id-preview--x.lovable.app.evil.com.
  const isLovableIdPreview =
    host.startsWith("id-preview--") && host.endsWith(".lovable.app");
  if (isLovableIdPreview) return true;

  return false;
}
