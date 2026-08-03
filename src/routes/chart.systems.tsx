import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChartNoAxesCombined, ChevronRight, Sparkles } from "lucide-react";

import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/chart/systems")({
  head: () => ({
    meta: [
      { title: "四系合参 · 命盘分析" },
      { name: "description", content: "了解命盘分析如何结合西占、印度、八字、紫微四套系统。" },
    ],
  }),
  component: ChartSystemsPage,
});

function ChartSystemsPage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const systems = [
    [zh ? "西方占星" : "Western", zh ? "看心理结构、动机、关系与阶段性转折。" : "Psychology, motive, bonds and turning points."],
    [zh ? "印度占星" : "Vedic", zh ? "看人生课题、时间节奏和长期倾向。" : "Life themes, timing and long-term tendencies."],
    [zh ? "八字" : "BaZi", zh ? "看五行平衡、资源方式、压力与行动路径。" : "Element balance, resources, pressure and action path."],
    [zh ? "紫微斗数" : "Zi Wei", zh ? "看宫位主题、人际结构和人生场景。" : "Palace themes, social structure and life arenas."],
  ];

  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <header className="mb-4 flex items-center justify-between">
          <Link to="/chart" aria-label={zh ? "返回命盘" : "Back to chart"} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-amber-100">
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/65">
              {zh ? "四系合参" : "Four systems"}
            </p>
            <h1 className="text-base font-semibold text-amber-50">
              {zh ? "我们的独特优势" : "What is different"}
            </h1>
          </div>
          <span className="h-11 w-11" />
        </header>

        <section className="relative overflow-hidden rounded-[30px] border border-amber-300/16 bg-gradient-to-br from-amber-300/12 via-white/[0.045] to-teal-300/10 p-4">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-teal-300/12 app-spin-ring" />
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
            <ChartNoAxesCombined aria-hidden className="h-4 w-4 text-amber-300" />
            {zh ? "交叉验证" : "Cross-checking"}
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-amber-50">
            {zh ? "不是单一结论，而是四种系统互相校验。" : "Not one verdict. Four systems cross-check."}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/62">
            {zh
              ? "同一份出生资料会进入四套阅读框架。报告不会把差异藏起来，而是说明哪些主题互相支持，哪些地方需要谨慎看待。"
              : "The same birth data enters four frameworks. The report shows where they agree and where caution is needed."}
          </p>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2">
          {systems.map(([title, body], index) => (
            <div key={title} className="min-h-[142px] rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
              <span className="text-xs font-semibold text-amber-300">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-base font-semibold text-amber-50">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/55">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Link to="/ritual" search={{ returnTo: "/report" } as never} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]">
            <Sparkles aria-hidden className="h-4 w-4" />
            {zh ? "用我的资料合参" : "Use my birth data"}
          </Link>
          <Link to="/chart/questions" className="flex min-h-12 items-center justify-center rounded-2xl border border-teal-300/25 px-4 text-sm font-medium text-teal-100 transition active:scale-[0.98]">
            {zh ? "选问题" : "Question"}
            <ChevronRight aria-hidden className="ml-1 h-4 w-4" />
          </Link>
        </section>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .app-spin-ring {
            animation: app-spin-ring 16s linear infinite;
          }
          @keyframes app-spin-ring {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        }
      `}</style>
    </main>
  );
}
