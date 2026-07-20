/**
 * Preview-only entry point for the Panorama Tour subsystem.
 *
 * Renders `PanoramaEntry` → `GuidedDomainReadingView` end-to-end with
 * `DEMO_PANORAMA_FACTS`, so QA can verify layouts at 1440/430/390 without
 * running the full V2 intake. Same guard as `/dev/guided-library-v2`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { isGuidedLibraryV2PreviewAllowed } from "@/experiences/library-v2/preview-guard";
import {
  DEMO_DOMAIN_READINGS,
  DEMO_DOMAIN_SCORES,
  DEMO_RECOMMENDATION,
} from "@/experiences/library-v2/panorama/fixtures";
import {
  GuidedDomainReadingView,
  PanoramaEntry,
} from "@/experiences/library-v2/panorama/PanoramaTour";
import type { DomainKey } from "@/experiences/library-v2/panorama/types";

export const Route = createFileRoute("/dev/panorama-tour")({
  head: () => ({
    meta: [
      { title: "Preview — Panorama Tour" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PanoramaTourPreview,
});

type Guard = "checking" | "allowed" | "blocked";

function PanoramaTourPreview() {
  const [guard, setGuard] = useState<Guard>("checking");
  const [selected, setSelected] = useState<DomainKey | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isDev = Boolean(import.meta.env.DEV);
    setGuard(isGuidedLibraryV2PreviewAllowed({ hostname, isDev }) ? "allowed" : "blocked");
  }, []);

  if (guard === "checking") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-obsidian" aria-busy="true">
        <p className="font-mono text-[10px] tracking-[0.4em] text-stone-warm/50">LOADING PREVIEW…</p>
      </div>
    );
  }
  if (guard === "blocked") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-obsidian px-6 text-center">
        <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust">NOT AVAILABLE</p>
      </div>
    );
  }

  if (selected) {
    const reading = DEMO_DOMAIN_READINGS[selected];
    const score = DEMO_DOMAIN_SCORES.find((s) => s.domain === selected)!;
    return (
      <div className="min-h-[100dvh] bg-obsidian">
        <GuidedDomainReadingView
          reading={reading}
          score={score}
          recommendReason={selected === DEMO_RECOMMENDATION.domain ? DEMO_RECOMMENDATION.reason_text : undefined}
          onFull={() => alert("Demo: continue to full panorama (stub)")}
          onBack={() => { setSelected(null); setFullOpen(false); }}
          fullOpen={fullOpen}
          onExpand={() => setFullOpen(true)}
          reducedMotion={reducedMotion}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-obsidian">
      <PanoramaEntry
        scores={DEMO_DOMAIN_SCORES}
        recommended={DEMO_RECOMMENDATION}
        onPick={(d) => setSelected(d)}
        onOverview={() => alert("Demo: overview panorama (stub)")}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
