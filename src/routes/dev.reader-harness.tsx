/**
 * Dev-only harness that renders the real <PremiumReportReader/> with a
 * deterministic 24-chapter fixture pinned to the CURRENT
 * PREMIUM_REPORT_REVISION. No auth, no network, no AI, no DB.
 *
 * The route is guarded by `import.meta.env.DEV`. In production builds
 * this check evaluates statically to false and the component returns a
 * neutral "not available" screen. The `injectedContent` prop that the
 * harness uses is otherwise unreachable — no other caller passes it.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PremiumReportReader } from "@/components/PremiumReportReader";
import { buildReaderFixture } from "@/lib/premium-reader-fixture";

export const Route = createFileRoute("/dev/reader-harness")({
  head: () => ({
    meta: [
      { title: "Dev — Premium Reader Harness" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReaderHarnessPage,
});

function ReaderHarnessPage() {
  const enabled = Boolean(import.meta.env.DEV);
  const [open, setOpen] = useState(true);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const { content, progress } = useMemo(() => buildReaderFixture(lang), [lang]);

  if (!enabled) {
    return (
      <div className="min-h-screen bg-black text-neutral-300 flex items-center justify-center px-6">
        <p className="max-w-md text-center text-sm">
          This preview is only available in development builds.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="reader-harness-root"
      className="min-h-screen bg-obsidian text-stone-warm px-4 py-6"
    >
      <header className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <h1 className="text-xl font-serif text-gold-light">Premium Reader Harness</h1>
        <span
          data-testid="reader-harness-revision"
          className="rounded-full border border-gold-dust/40 px-3 py-1 text-[11px] uppercase tracking-widest text-gold-dust"
        >
          {content.meta.prompt_version}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-stone-warm/60">
          chapters {content.chapters.length}/24
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="min-h-11 rounded-full border border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-stone-warm/80 hover:border-gold-dust/40 hover:text-gold-dust"
          >
            {lang === "zh" ? "EN" : "中"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-full border border-gold-dust/50 bg-gold-dust/10 px-4 py-1.5 text-[11px] uppercase tracking-widest text-gold-light hover:bg-gold-dust/20"
          >
            Open reader
          </button>
        </div>
      </header>
      <p className="mx-auto mt-4 max-w-3xl text-sm text-stone-warm/60">
        DEV ONLY · deterministic fixture · no AI, no DB. Renders the real{" "}
        <code className="text-gold-dust/80">PremiumReportReader</code> with 24 chapters pinned to{" "}
        <code className="text-gold-dust/80">{content.meta.prompt_version}</code>.
      </p>
      <PremiumReportReader
        open={open}
        chartId="fixture-chart"
        chartName={content.meta.chart_name}
        onClose={() => setOpen(false)}
        injectedContent={content}
        injectedProgress={progress}
      />
    </div>
  );
}
