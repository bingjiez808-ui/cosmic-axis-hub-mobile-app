/**
 * Dev-only preview route for Guided Library V2.
 *
 * Guard: renders a "Not available" screen in production. On the published
 * site, `import.meta.env.DEV` is `false`, so the route body 404-equivalents
 * and no V2 code paths render. This route is intentionally excluded from
 * `src/routes/sitemap[.]xml.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { GuidedLibraryV2 } from "@/experiences/library-v2/GuidedLibraryV2";
import { LIBRARY_EXPERIENCE_VERSION } from "@/experiences/library-v2/version";

export const Route = createFileRoute("/dev/guided-library-v2")({
  head: () => ({
    meta: [
      { title: "Dev — Guided Library V2" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GuidedLibraryV2Page,
});

function GuidedLibraryV2Page() {
  const enabled = Boolean(import.meta.env.DEV);
  if (!enabled) {
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
