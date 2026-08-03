/**
 * Dev-only preview of the v3 24-chapter Premium Deep Reading UI.
 *
 * Guard: renders a 404-style "Not available" screen unless
 * `import.meta.env.DEV` is truthy. Production builds strip DEV so the
 * route effectively 404s for regular users on the published site.
 * The route file must exist to satisfy TanStack file-based routing,
 * but the component body enforces the gate at render time.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PREMIUM_V3_DEMO_SAMPLE } from "@/lib/premium-demo-v3";
import { PREMIUM_V3_CHAPTERS } from "@/lib/premium-chapters-v3";
import { AI_BUDGET_POLICY, describeCallPath } from "@/lib/budget-policy";

export const Route = createFileRoute("/dev/demo-premium")({
  head: () => ({
    meta: [
      { title: "Dev — Premium Deep Reading v3 Demo" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DemoPremiumPage,
});

function DemoPremiumPage() {
  const enabled = Boolean(import.meta.env.DEV);
  const [activeKey, setActiveKey] = useState<string>(PREMIUM_V3_DEMO_SAMPLE.chapters[0]?.key ?? "");
  const activeIndex = useMemo(
    () => PREMIUM_V3_CHAPTERS.findIndex((c) => c.key === activeKey),
    [activeKey],
  );
  const chapter = PREMIUM_V3_DEMO_SAMPLE.chapters[Math.max(0, activeIndex)];

  if (!enabled) {
    return (
      <div className="min-h-screen bg-black text-neutral-300 flex items-center justify-center px-6">
        <p className="max-w-md text-center text-sm">
          This preview is only available in development builds.
        </p>
      </div>
    );
  }

  const callPath = describeCallPath(PREMIUM_V3_CHAPTERS.length);

  return (
    <div className="min-h-screen bg-black text-neutral-200 px-4 sm:px-8 py-8">
      <div
        role="alert"
        className="mb-6 rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-200"
      >
        <strong className="mr-2">DEMO SAMPLE — NOT A REAL USER.</strong>
        本页面为开发预览。所有内容为演示数据，非真实客户命盘；生产环境普通用户不显示此入口。
      </div>

      <header className="mb-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-serif text-amber-300 mb-2">
          {PREMIUM_V3_DEMO_SAMPLE.cover.title}
        </h1>
        <p className="text-sm text-neutral-400">{PREMIUM_V3_DEMO_SAMPLE.cover.subtitle}</p>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-500">
          <div><dt>Schema</dt><dd className="text-neutral-300">{PREMIUM_V3_DEMO_SAMPLE.schema_version}</dd></div>
          <div><dt>Prompt</dt><dd className="text-neutral-300">{PREMIUM_V3_DEMO_SAMPLE.meta.prompt_version}</dd></div>
          <div><dt>Model</dt><dd className="text-neutral-300">{AI_BUDGET_POLICY.model_id}</dd></div>
          <div><dt>Chapters</dt><dd className="text-neutral-300">{PREMIUM_V3_DEMO_SAMPLE.chapters.length}</dd></div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="章节目录" className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">章节目录</h2>
          <ol className="space-y-1 text-sm max-h-[70vh] overflow-y-auto pr-2">
            {PREMIUM_V3_DEMO_SAMPLE.chapters.map((c, i) => {
              const isActive = c.key === activeKey;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(c.key)}
                    className={`w-full text-left px-2 py-1.5 rounded min-h-11 ${
                      isActive
                        ? "bg-amber-500/15 text-amber-200"
                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                    }`}
                  >
                    <span className="text-xs text-neutral-500 mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {c.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="min-w-0 max-w-3xl">
          {chapter ? (
            <>
              <h2 className="text-xl sm:text-2xl font-serif text-amber-200 mb-4">{chapter.title}</h2>
              <div className="prose prose-invert text-neutral-200 leading-relaxed space-y-4">
                {chapter.body.split(/\n\n+/).map((p, i) => (
                  <p key={i} className="whitespace-pre-line">{p}</p>
                ))}
              </div>

              {chapter.evidence_refs.length > 0 && (
                <details className="mt-6 rounded border border-white/10 bg-white/5 p-3">
                  <summary className="cursor-pointer text-sm text-amber-300/80">
                    Evidence refs · {chapter.evidence_refs.length}
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-neutral-400 font-mono">
                    {chapter.evidence_refs.map((r, i) => (
                      <li key={i}>
                        <span className="text-amber-300/70">{r.module}</span>
                        <span className="mx-1">·</span>
                        <span>{r.path}</span>
                        <span className="ml-2 text-neutral-500">[{r.confidence}]</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p>Chapter not found.</p>
          )}

          <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-neutral-500 space-y-2">
            <p>
              AI 消耗路径（演示）：新报告约 {callPath.calls_per_new_report} 次调用；缓存查看 {callPath.cache_hit_calls} 次；
              本地排盘 {callPath.local_calculation_calls} 次。
            </p>
            <p>
              预算上限：input ≤ {callPath.hard_report_cap.input.toLocaleString()} tokens，output ≤{" "}
              {callPath.hard_report_cap.output.toLocaleString()} tokens；超出立即停止为 partial。
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
