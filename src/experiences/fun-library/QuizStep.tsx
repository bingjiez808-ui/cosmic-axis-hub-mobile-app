/**
 * Fun Library · single-screen quiz step. Mobile 393 first.
 */

import { useLang } from "@/lib/i18n";
import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";
import type { QuizQuestion } from "./personality/types";

export function QuizStep({
  question,
  index,
  total,
  selected,
  onPick,
  onBack,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: string | null;
  onPick: (optionId: string) => void;
  onBack?: () => void;
}) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const isZh = lang === "zh";
  const anim = reduced ? "" : "animate-fade-in";

  return (
    <section
      key={question.id}
      aria-live="polite"
      className={`mx-auto max-w-2xl rounded-2xl border border-amber-300/15 bg-[#100c1c]/70 p-5 md:p-8 ${anim}`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-amber-200/70">
        <span>{isZh ? "题目" : "Scene"}</span>
        <span aria-label={isZh ? `第 ${index + 1} 题，共 ${total} 题` : `question ${index + 1} of ${total}`}>
          {index + 1} / {total}
        </span>
      </div>
      <div
        aria-hidden
        className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-amber-300/10"
      >
        <div
          className="h-full bg-amber-300/70 transition-all duration-500"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <h2 className="mt-6 font-serif text-2xl leading-snug text-amber-100 md:text-3xl">
        {isZh ? question.zh : question.en}
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        {question.options.map((opt, i) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt.id)}
              aria-pressed={active}
              className={`group flex min-h-14 items-start gap-3 rounded-xl border px-4 py-3 text-left text-[14px] leading-relaxed transition ${
                active
                  ? "border-amber-300 bg-amber-300/15 text-amber-100"
                  : "border-amber-300/20 bg-black/20 text-stone-200/85 hover:border-amber-300/60 hover:bg-amber-300/5"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border font-serif text-[12px] ${
                  active ? "border-amber-200 text-amber-100" : "border-amber-300/40 text-amber-200/70"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span>{isZh ? opt.zh : opt.en}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="inline-flex min-h-10 items-center rounded-full px-4 text-[11px] uppercase tracking-[0.28em] text-amber-200/70 transition hover:text-amber-100 disabled:opacity-30"
        >
          {isZh ? "上一题" : "Previous"}
        </button>
        <span className="text-[11px] uppercase tracking-[0.28em] text-stone-300/50">
          {isZh ? "点击一项即前进" : "Tap a choice to advance"}
        </span>
      </div>
    </section>
  );
}
