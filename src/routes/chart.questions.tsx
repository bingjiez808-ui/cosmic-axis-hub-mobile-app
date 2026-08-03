import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, ChevronRight, Compass, Sparkles } from "lucide-react";
import { useState } from "react";

import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/chart/questions")({
  head: () => ({
    meta: [
      { title: "问题导航 · 命盘分析" },
      { name: "description", content: "选择你带来的问题，再进入命盘仪式。" },
    ],
  }),
  component: ChartQuestionsPage,
});

function ChartQuestionsPage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [selected, setSelected] = useState(0);
  const questions = [
    {
      title: zh ? "学业与成长" : "Study and growth",
      prompt: zh ? "我适合怎样学习？我的优势到底在哪里？" : "How should I learn? Where are my strengths?",
      detail: zh ? "帮你区分学习方式、优势类型、被忽视的能力和当前该补的关键环节。" : "Clarifies learning style, strengths and the next ability to repair.",
      helps: zh ? ["学习方式", "优势识别", "路径调整"] : ["Learning style", "Strengths", "Path shift"],
    },
    {
      title: zh ? "事业与选择" : "Career and choice",
      prompt: zh ? "我正在走的路适合我吗？什么时候该继续或转向？" : "Does my path fit me? When should I turn?",
      detail: zh ? "把职业节奏、压力来源、长期动机和转向信号拆开看。" : "Separates work rhythm, pressure, motive and turn signals.",
      helps: zh ? ["事业节奏", "压力消耗", "转向信号"] : ["Rhythm", "Pressure", "Turn signal"],
    },
    {
      title: zh ? "爱情与亲密关系" : "Love and intimacy",
      prompt: zh ? "为什么我总被某一类人吸引？我真正需要怎样的关系？" : "Why am I drawn to one type? What bond do I need?",
      detail: zh ? "看吸引模式、边界、沟通方式和关系修复点。" : "Reads attraction, boundaries, communication and repair.",
      helps: zh ? ["吸引模式", "边界课题", "修复方式"] : ["Attraction", "Boundary", "Repair"],
    },
    {
      title: zh ? "财富与安全感" : "Wealth and safety",
      prompt: zh ? "我的财富主要靠什么能力？为什么钱总是难留下？" : "What supports wealth? Why is money hard to keep?",
      detail: zh ? "从资源交换、风险感、积累节奏和自我价值感切入。" : "Looks at resources, risk, accumulation and self-worth.",
      helps: zh ? ["资源方式", "风险习惯", "积累节奏"] : ["Resources", "Risk habit", "Accumulation"],
    },
    {
      title: zh ? "自我与人生阶段" : "Self and life stage",
      prompt: zh ? "为什么我总在相同的问题里反复？哪些期待并不属于我？" : "Why do I repeat this issue? Which expectations are not mine?",
      detail: zh ? "把家庭脚本、自我认同和当前人生任务放在一起看。" : "Links family scripts, identity and current life task.",
      helps: zh ? ["反复主题", "家庭期待", "阶段任务"] : ["Repeating theme", "Expectation", "Life task"],
    },
  ];
  const active = questions[selected] ?? questions[0];

  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <header className="mb-4 flex items-center justify-between">
          <Link to="/chart" aria-label={zh ? "返回命盘" : "Back to chart"} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-amber-100">
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/65">
              {zh ? "问题导航" : "Question guide"}
            </p>
            <h1 className="text-base font-semibold text-amber-50">
              {zh ? "先说你想问什么" : "Name your question"}
            </h1>
          </div>
          <span className="h-11 w-11" />
        </header>

        <section className="rounded-[28px] border border-amber-300/16 bg-gradient-to-br from-amber-300/12 via-white/[0.04] to-teal-300/8 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
            <Compass aria-hidden className="h-4 w-4 text-amber-300" />
            {zh ? "选择方向" : "Pick direction"}
          </div>
          <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {questions.map((question, index) => (
              <button
                key={question.title}
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
                className={`min-w-[174px] snap-start rounded-[22px] border p-3 text-left transition active:scale-[0.98] ${
                  selected === index ? "border-amber-300/55 bg-amber-300/12" : "border-white/10 bg-black/24"
                }`}
              >
                <div className="text-sm font-semibold text-amber-50">{question.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-amber-100/55">{question.prompt}</p>
              </button>
            ))}
          </div>
        </section>

        <section key={active.title} className="question-panel mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045]">
          <div className="border-b border-amber-300/12 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-amber-300/70">
                {zh ? "你选择了" : "Selected"}
              </span>
              <BookOpen aria-hidden className="h-5 w-5 text-teal-200" />
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-amber-50">{active.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/66">{active.detail}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3">
            {active.helps.map((item) => (
              <div key={item} className="rounded-[18px] border border-teal-300/14 bg-teal-300/[0.055] px-2 py-3 text-center text-xs font-medium text-teal-100">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Link
            to="/ritual"
            search={{ returnTo: "/report" } as never}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            {zh ? "带着这个问题进入仪式" : "Start ritual"}
          </Link>
          <Link to="/chart/sample" className="flex min-h-12 items-center justify-center rounded-2xl border border-teal-300/25 px-4 text-sm font-medium text-teal-100 transition active:scale-[0.98]">
            {zh ? "样本" : "Sample"}
            <ChevronRight aria-hidden className="ml-1 h-4 w-4" />
          </Link>
        </section>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .question-panel {
            animation: question-panel-in 260ms ease-out;
          }
          @keyframes question-panel-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </main>
  );
}
