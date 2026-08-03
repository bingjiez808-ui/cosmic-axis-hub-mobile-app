import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, FileText, ListChecks, Sparkles } from "lucide-react";

import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/chart/sample")({
  head: () => ({
    meta: [
      { title: "报告样本 · 命盘分析" },
      { name: "description", content: "命盘报告样本预览，展示章节和主要功能。" },
    ],
  }),
  component: ChartSamplePage,
});

function ChartSamplePage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const chapters = [
    [zh ? "核心气质" : "Core temperament", zh ? "你天然如何判断、吸收压力和做决定。" : "How you decide, absorb pressure and move."],
    [zh ? "事业与学习" : "Career and study", zh ? "适合的节奏、容易误判的能力和转向信号。" : "Rhythm, overlooked ability and turn signals."],
    [zh ? "关系模式" : "Bond pattern", zh ? "吸引、边界、沟通与修复方式。" : "Attraction, boundaries, communication and repair."],
    [zh ? "当下时间线" : "Current timeline", zh ? "近期更适合推进、整理或等待的主题。" : "Where to push, sort or wait in the near term."],
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
              {zh ? "报告样本" : "Report sample"}
            </p>
            <h1 className="text-base font-semibold text-amber-50">
              {zh ? "生成后大致长这样" : "What you receive"}
            </h1>
          </div>
          <span className="h-11 w-11" />
        </header>

        <section className="overflow-hidden rounded-[30px] border border-amber-300/16 bg-white/[0.045]">
          <div className="relative">
            <img src="/assets/app-home/report-preview-app.png" alt="" className="h-56 w-full object-cover object-top opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080910] via-[#080910]/42 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-200/72">
                <FileText aria-hidden className="h-4 w-4 text-amber-300" />
                {zh ? "个人命盘报告" : "Personal chart report"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-amber-50">
                {zh ? "不是长篇玄谈，是按问题排列的阅读书架。" : "Not a long essay. A shelf arranged by question."}
              </h2>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-teal-100/70">
            <ListChecks aria-hidden className="h-4 w-4 text-teal-200" />
            {zh ? "报告章节" : "Chapters"}
          </div>
          <div className="grid gap-2">
            {chapters.map(([title, body], index) => (
              <div key={title} className="rounded-[20px] border border-white/10 bg-black/24 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-300">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="text-sm font-semibold text-amber-50">{title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-amber-100/56">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Link to="/ritual" search={{ returnTo: "/report" } as never} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]">
            <Sparkles aria-hidden className="h-4 w-4" />
            {zh ? "进入仪式生成我的报告" : "Generate my report"}
          </Link>
          <Link to="/chart/systems" className="flex min-h-12 items-center justify-center rounded-2xl border border-teal-300/25 px-4 text-sm font-medium text-teal-100 transition active:scale-[0.98]">
            {zh ? "四系" : "Systems"}
            <ChevronRight aria-hidden className="ml-1 h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
