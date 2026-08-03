/**
 * Lovable Preview / Local-only preview route for Guided Library V2.
 *
 * Access policy (see `preview-guard.ts`):
 *   - Local dev (`import.meta.env.DEV`)
 *   - `localhost` / `127.0.0.1` / `::1`
 *   - Lovable id-preview hosts: `id-preview--*.lovable.app`
 *
 * The published domain (fate-nexus-ai.lovable.app) and every other host
 * render a plain "Not available" screen. This route stays out of
 * `src/routes/sitemap[.]xml.ts` and always emits `noindex,nofollow`.
 *
 * SSR safety: we do not touch `window` during server render. The guard
 * resolves after mount; a short neutral placeholder covers the tick
 * between hydration and the client-side decision to avoid flashing V2
 * content on the production domain.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GuidedLibraryV2 } from "@/experiences/library-v2/GuidedLibraryV2";
import { LIBRARY_EXPERIENCE_VERSION } from "@/experiences/library-v2/version";
import { isGuidedLibraryV2PreviewAllowed } from "@/experiences/library-v2/preview-guard";

export const Route = createFileRoute("/dev/guided-library-v2")({
  head: () => ({
    meta: [
      { title: "Preview — Guided Library V2" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GuidedLibraryV2Page,
});

type GuardState = "checking" | "allowed" | "blocked";

function GuidedLibraryV2Page() {
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    // Read the hostname only on the client — never at module scope,
    // and never during SSR. This also avoids hydration flashes: the
    // first client paint is the "checking" placeholder, matching SSR.
    const hostname =
      typeof window !== "undefined" && window.location
        ? window.location.hostname
        : "";
    const isDev = Boolean(import.meta.env.DEV);
    const allowed = isGuidedLibraryV2PreviewAllowed({ hostname, isDev });
    setState(allowed ? "allowed" : "blocked");
  }, []);

  if (state === "checking") {
    return (
      <div
        className="grid min-h-[100dvh] place-items-center bg-obsidian px-6 text-center"
        aria-busy="true"
      >
        <p className="font-mono text-[10px] tracking-[0.4em] text-stone-warm/50">
          LOADING PREVIEW…
        </p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-obsidian px-6 text-center">
        <div className="max-w-md">
          <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust">
            NOT AVAILABLE
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-warm">
            This preview is not available on the published site.
          </h1>
          <p className="mt-3 text-sm text-stone-warm/60">
            {LIBRARY_EXPERIENCE_VERSION}
          </p>
        </div>
      </div>
    );
  }

  return <GuidedLibraryV2 />;
}
