/**
 * YearInsightModal — deterministic per-year deep-dive.
 *
 * Rules enforced here:
 *   • Content comes ONLY from calculation-side facts: the deterministic
 *     `computeEnergyScore` value, the theme keyword derived from the
 *     surrounding decade band, and (optionally) a saved report chapter
 *     the caller passes in. No AI calls, no fetches, no random.
 *   • Wording is conditional / reflective. We never diagnose disease,
 *     forecast disaster or death, promise investment returns, or state
 *     a specific event as certain.
 *   • Insufficient data ⇒ the modal renders a plain "not enough data"
 *     panel rather than fabricating a story.
 *   • Portal + high z-index + body scroll lock + ESC/backdrop close +
 *     focus management + full-screen on mobile with scroll.
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import type { Lang } from "@/lib/i18n";

export type YearInsightSystem = {
  name: "bazi" | "ziwei" | "vedic" | "western";
  available: boolean;
  score: number | null;
  direction: "up" | "stable" | "down" | null;
  confidence: "reference_only" | "low" | "mid" | "high";
  brief: string;
  opportunity: string;
  caution: string;
  evidenceRefs: string[];
  reasonUnavailable?: string;
};

export type YearInsightPoint = {
  age: number;
  score: number | null;
  /** Short, conditional theme fragment sourced from the deterministic pool. */
  theme: string;
  /** Optional saved facts (from an already-generated premium chapter). */
  facts?: string[];
  /** Optional saved evidence refs (already-generated premium chapter). */
  evidenceRefs?: string[];
  /** Confidence tier for the year insight surface. */
  confidence?: "reference" | "low" | "mid" | "high" | "reference_only";
  /** True when the surface is falling back to the reference pool because
   *  the report has not been generated / is missing this year. */
  reference?: boolean;
  /** Calendar year, if the caller can compute it. */
  year?: number | null;
  /** Per-system deterministic readings (from year_readings_v1). */
  systems?: YearInsightSystem[];
  /** Names of unavailable systems. */
  unavailableSystems?: string[];
  /** Composite interpretation from the deterministic engine. */
  interpretation?: { brief: string; opportunity: string; caution: string };
  /** Composite advice from the deterministic engine. */
  advice?: { suggestion: string; boundary: string };
};

const T = {
  kicker: { zh: "逐年细读", en: "Year insight" },
  ageSuffix: { zh: "岁", en: "" },
  energy_label: { zh: "能量分（相对趋势）", en: "Energy (relative trend)" },
  theme_label: { zh: "本年主题", en: "Theme" },
  opportunity: { zh: "机会方向", en: "Where the energy opens" },
  watch: { zh: "需要留意", en: "Where to stay careful" },
  suggestion: { zh: "一个可行的小建议", en: "One practical suggestion" },
  basis: { zh: "信息依据 · 置信度", en: "Basis · confidence" },
  disclaimer: {
    zh: "本页仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。",
    en: "For cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
  },
  insufficient: {
    zh: "缺少完整的出生资料，暂无法呈现本年细读。",
    en: "Not enough birth data to render this year's insight.",
  },
  close: { zh: "关闭", en: "Close" },
  reference: {
    zh: "参考级 · 尚未生成完整深度报告，以下内容基于确定性能量趋势与主题关键词，措辞刻意保守。",
    en: "Reference tier · full premium report not yet generated. The text below is derived from the deterministic energy trend and theme keyword; wording is intentionally conservative.",
  },
  conf: {
    reference: { zh: "参考级", en: "Reference" },
    reference_only: { zh: "参考级", en: "Reference" },
    low: { zh: "低置信", en: "Low" },
    mid: { zh: "中置信", en: "Medium" },
    high: { zh: "高置信", en: "High" },
  },
} as const;

function pick<T extends { zh: string; en: string }>(t: T, lang: Lang): string {
  return lang === "zh" ? t.zh : t.en;
}

/**
 * Deterministic score-band → conditional copy. Wording is intentionally
 * cautious: no illness, no disaster, no investment returns, no certainty.
 */
function deriveBands(score: number, lang: Lang) {
  if (score >= 70) {
    return lang === "zh"
      ? {
          opportunity:
            "外在可见度上升，容易被看见与邀请；适合把长期打磨的作品公开发表。",
          watch:
            "步伐拉快时留一点缓冲，避免只有输出没有恢复；对新出现的邀约保留过滤。",
          suggestion:
            "把本年的一个「小的公开动作」写进日历，例如一次分享、一次投稿或一次自我介绍更新。",
        }
      : {
          opportunity:
            "Visibility trends upward — a good year to release something you've been quietly refining.",
          watch:
            "When the pace speeds up, leave a buffer for rest; filter incoming invitations rather than accept all.",
          suggestion:
            "Put one small public gesture on the calendar this year — a talk, a submission, or a refreshed introduction.",
        };
  }
  if (score >= 45) {
    return lang === "zh"
      ? {
          opportunity:
            "节奏平衡，是把过去两三年学到的东西「稳定输出」的年份；关系里适合把边界说清楚。",
          watch:
            "容易低估自身进展，反复重启同一件事；把注意力放在完成一件而不是同时开三件。",
          suggestion:
            "选一项进行中的项目，本年目标只是「让它有可读的版本」，其余延后。",
        }
      : {
          opportunity:
            "A steady, integrating year — the phase where the last two or three years of learning become a reliable output.",
          watch:
            "It's easy to underestimate progress and re-start the same project; keep the focus on finishing one thing.",
          suggestion:
            "Pick one in-progress project and make its only goal this year 'a readable version'; defer the rest.",
        };
  }
  return lang === "zh"
    ? {
        opportunity:
          "更偏「向内」的年份，适合修订、整理、复盘，安静地打地基；关系里适合修补而非扩张。",
        watch:
          "对外部承诺保持克制，避免为证明状态而接下过多事；情绪波动可以被记录，不必被立刻解释。",
        suggestion:
          "把本年一个固定的「静修时段」写进日历（例如每周半天不安排会议或社交）。",
      }
    : {
        opportunity:
          "An inward year — suited to revising, organising, and quietly rebuilding foundations; relationships prefer repair over expansion.",
        watch:
          "Stay measured with outward commitments; you don't need to prove state by taking on more.",
        suggestion:
          "Schedule one recurring quiet block this year (for example, half a day per week with no meetings or social plans).",
      };
}

export function YearInsightModal({
  open,
  point,
  lang,
  onClose,
  returnFocus,
}: {
  open: boolean;
  point: YearInsightPoint | null;
  lang: Lang;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open && returnFocus) {
      requestAnimationFrame(() => returnFocus.focus?.());
    }
  }, [open, returnFocus]);

  const bands = useMemo(
    () => (point && point.score != null ? deriveBands(point.score, lang) : null),
    [point, lang],
  );

  if (!open || !point) return null;
  if (typeof document === "undefined") return null;

  const confidence = point.confidence ?? (point.reference ? "reference" : "mid");

  const body = (
    <AnimatePresence>
      <motion.div
        key="year-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="presentation"
        className="fixed inset-0 z-[90] flex items-end justify-center bg-obsidian/80 backdrop-blur-md sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="year-insight-modal"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="glass-card relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-3xl p-6 focus:outline-none sm:max-h-[86vh] sm:max-w-xl sm:rounded-3xl sm:p-8"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={pick(T.close, lang)}
            className="absolute right-4 top-4 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
          >
            ✕
          </button>

          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
            {pick(T.kicker, lang)}
          </p>
          <h3 id={titleId} className="mt-1 font-serif text-2xl italic text-stone-warm">
            {point.age}
            {pick(T.ageSuffix, lang)}
            {point.year ? ` · ${point.year}` : ""}
          </h3>

          {point.score == null ? (
            <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-stone-warm/70">
              {pick(T.insufficient, lang)}
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] px-4 py-3">
                <span className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60">
                  {pick(T.energy_label, lang)}
                </span>
                <span className="font-serif text-2xl italic text-gold-light">
                  {point.score}
                </span>
              </div>

              <section className="mt-5">
                <p className="text-[10.5px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {pick(T.theme_label, lang)}
                </p>
                <p className="mt-1 font-serif text-lg italic leading-relaxed text-stone-warm/85 [overflow-wrap:break-word]">
                  {point.theme}
                </p>
              </section>

              {bands && (
                <>
                  <section className="mt-5">
                    <p className="text-[10.5px] uppercase tracking-[0.28em] text-gold-dust/70">
                      {pick(T.opportunity, lang)}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-stone-warm/80 [overflow-wrap:break-word]">
                      {bands.opportunity}
                    </p>
                  </section>
                  <section className="mt-5">
                    <p className="text-[10.5px] uppercase tracking-[0.28em] text-gold-dust/70">
                      {pick(T.watch, lang)}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-stone-warm/80 [overflow-wrap:break-word]">
                      {bands.watch}
                    </p>
                  </section>
                  <section className="mt-5">
                    <p className="text-[10.5px] uppercase tracking-[0.28em] text-gold-dust/70">
                      {pick(T.suggestion, lang)}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-stone-warm/80 [overflow-wrap:break-word]">
                      {bands.suggestion}
                    </p>
                  </section>
                </>
              )}

              {point.facts && point.facts.length > 0 && (
                <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[10.5px] uppercase tracking-[0.28em] text-stone-warm/50">
                    {lang === "zh" ? "本年支持事实" : "Supporting facts"}
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-stone-warm/75">
                    {point.facts.slice(0, 6).map((f, i) => (
                      <li key={i} className="[overflow-wrap:break-word]">
                        · {f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-5 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.24em] text-stone-warm/55">
                <span>{pick(T.basis, lang)}：</span>
                <span className="rounded-full border border-gold-dust/40 bg-gold-dust/[0.05] px-2 py-0.5 text-gold-light">
                  {pick(T.conf[confidence], lang)}
                </span>
                {point.reference && (
                  <span className="rounded-full border border-nebula-purple/40 bg-nebula-purple/[0.06] px-2 py-0.5 text-stone-warm/70">
                    {lang === "zh" ? "参考级" : "reference"}
                  </span>
                )}
              </section>

              {point.reference && (
                <p className="mt-3 rounded-xl border border-nebula-purple/30 bg-nebula-purple/[0.05] p-3 text-[11.5px] leading-relaxed text-stone-warm/70 [overflow-wrap:break-word]">
                  {pick(T.reference, lang)}
                </p>
              )}
            </>
          )}

          <p className="mt-6 border-t border-white/5 pt-3 text-[10.5px] leading-relaxed text-stone-warm/45 [overflow-wrap:break-word]">
            {pick(T.disclaimer, lang)}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}
