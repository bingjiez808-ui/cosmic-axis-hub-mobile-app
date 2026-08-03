import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

import { LIFE_EXPERIMENTS } from "./experiments";
import {
  DIMENSION_COLORS,
  DIMENSION_LABELS,
  LIFE_DIMENSIONS,
  type LifeExperiment,
  type LifeMathPoint,
} from "./types";

export function ExperimentLab({
  points,
  activeExperimentId,
  onSelect,
  onUndo,
  onCompareToggle,
  compareMode,
  onSaveBranch,
  savedBranchIds,
  lang,
  chartHref = "/life-studies/math/curve",
}: {
  points: LifeMathPoint[];
  activeExperimentId: string | null;
  onSelect: (id: string | null) => void;
  onUndo: () => void;
  onCompareToggle: () => void;
  compareMode: boolean;
  onSaveBranch: () => void;
  savedBranchIds: string[];
  lang: "zh" | "en";
  chartHref?: "/life-studies/math/curve";
}) {
  const isZh = lang === "zh";
  const active: LifeExperiment | null = useMemo(
    () => LIFE_EXPERIMENTS.find((e) => e.id === activeExperimentId) ?? null,
    [activeExperimentId],
  );
  const isSaved = active ? savedBranchIds.includes(active.id) : false;

  const impact = useMemo(() => {
    if (!active) return null;
    const startIdx = points.findIndex((p) => p.age >= active.startAge);
    const endIdx = Math.min(points.length - 1, startIdx + 8);
    if (startIdx < 0) return null;
    const before = points[startIdx];
    const after  = points[endIdx];
    const dims = LIFE_DIMENSIONS.map((d) => ({
      d,
      before: before.dimensions[d],
      after:  after.dimensionsExperiment[d],
      delta:  after.dimensionsExperiment[d] - before.dimensions[d],
    }));
    return {
      dims,
      compositeBefore: before.currentPath,
      compositeAfter:  after.experimentPath,
    };
  }, [active, points]);

  return (
    <section className="rounded-2xl border border-cyan-400/25 bg-[#0b0b14]/80 p-4 md:p-5" data-testid="experiment-lab">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">
            {isZh ? "选择实验室" : "Choice Lab"}
          </div>
          <h3 className="mt-1 font-serif text-lg text-amber-50">
            {isZh ? "选择实验室 · 如果只改变一件事" : "Choice Lab · If only one thing changed"}
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-amber-100/85">
            {isZh
              ? "一次只调整一个变量, 观察它如何影响学业、事业、爱情、家庭、人际、财富与健康七个维度。实验结果是对照情景, 不是命运改写。"
              : "Change one variable at a time and watch its effect across study, career, love, family, social, wealth, and health. It is a comparison scenario — not a rewriting of fate."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUndo} disabled={!active} data-testid="experiment-undo"
            className={`min-h-9 rounded-full border px-3 text-[11px] ${active ? "border-amber-400/40 text-amber-100 hover:bg-amber-400/10" : "cursor-not-allowed border-white/10 text-white/30"}`}>
            {isZh ? "撤销实验" : "Undo"}
          </button>
          <button type="button" onClick={onCompareToggle} disabled={!active} aria-pressed={compareMode} data-testid="experiment-compare"
            className={`min-h-9 rounded-full border px-3 text-[11px] ${compareMode ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-50" : active ? "border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/10" : "cursor-not-allowed border-white/10 text-white/30"}`}>
            {isZh ? "与原路径对照" : "Compare vs current"}
          </button>
          <button type="button" onClick={onSaveBranch} disabled={!active} data-testid="experiment-save"
            className={`min-h-9 rounded-full border px-3 text-[11px] ${
              isSaved ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-50" :
              active  ? "border-amber-300/60 bg-amber-300/10 text-amber-50 hover:bg-amber-300/20" :
                        "cursor-not-allowed border-white/10 text-white/30"
            }`}>
            {isSaved ? (isZh ? "已加入主图 ✓" : "Added to chart ✓") : (isZh ? "加入我的人生分支" : "Add to my branches")}
          </button>
          {active ? (
            <Link
              to={chartHref}
              data-testid="experiment-open-chart"
              className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/55 bg-cyan-300/12 px-3 py-2 text-[11px] text-cyan-50 transition active:scale-95"
            >
              {isZh ? "查看七维曲线变化" : "View on curve"}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/15 bg-[#0f0f1a]/70 px-3 py-2 text-[11px] text-amber-100/85">
        {active ? (
          isZh
            ? <>当前实验已回写到七维曲线: <span className="text-amber-50">{active.title.zh}</span> · 影响起点: {active.startAge} 岁 · 主要变化: {summarize(active, "zh")}</>
            : <>Current experiment is applied to the curve: <span className="text-amber-50">{active.title.en}</span> · from age {active.startAge} · main changes: {summarize(active, "en")}</>
        ) : (
          isZh
            ? "选择下方一个实验, 青绿色实验分支会从对应年龄开始, 逐步与现实路径分开。"
            : "Pick one experiment below — the cyan experiment branch will gradually diverge from the current path at that age."
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LIFE_EXPERIMENTS.map((exp) => {
          const on = activeExperimentId === exp.id;
          return (
            <button key={exp.id} type="button" onClick={() => onSelect(on ? null : exp.id)} aria-pressed={on} data-testid={`experiment-card-${exp.id}`}
              className={`min-h-[44px] text-left rounded-xl border p-3 text-[11px] transition ${
                on ? "border-cyan-300/70 bg-cyan-300/10 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]" :
                     "border-amber-400/15 bg-[#0f0f1a]/70 text-amber-100 hover:border-amber-400/35"
              }`}>
              <div className="text-[12px] font-medium text-amber-50">{exp.title[lang]}</div>
              <p className="mt-1 leading-relaxed text-amber-200/75">{exp.description[lang]}</p>
              <div className="mt-1 text-[10px] text-cyan-200/70">
                {isZh ? `起点 ${exp.startAge} 岁` : `From age ${exp.startAge}`}
              </div>
            </button>
          );
        })}
      </div>

      {active && impact && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-[#0f0f1a]/80 p-4" data-testid="experiment-result">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "这次实验改变了什么" : "What did this experiment change"}
            </div>
            <div className="text-[11px] text-amber-100/85">
              {isZh ? "综合" : "Composite"}: <span className="font-mono text-amber-200">{impact.compositeBefore.toFixed(0)}</span>
              <span className="mx-1 text-amber-200/40">→</span>
              <span className="font-mono text-cyan-200">{impact.compositeAfter.toFixed(0)}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 text-[12px] text-amber-100/90 md:grid-cols-3">
            <p><span className="text-amber-50">{isZh ? "短期 (1–3 年)" : "Short (1–3y)"}: </span>{active.shortTerm[lang]}</p>
            <p><span className="text-amber-50">{isZh ? "中期 (4–8 年)" : "Mid (4–8y)"}: </span>{active.midTerm[lang]}</p>
            <p><span className="text-amber-50">{isZh ? "代价与提醒" : "Cost & caveat"}: </span>{active.cost[lang]}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {impact.dims.map(({ d, delta, before, after }) => (
              <div key={d} className="rounded-lg border border-white/5 bg-black/30 p-2">
                <div className="flex items-center gap-1 text-[11px]" style={{ color: DIMENSION_COLORS[d] }}>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: DIMENSION_COLORS[d] }} />
                  {DIMENSION_LABELS[d][lang]}
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono text-[11px]">
                  <span className="text-amber-200/60">{Math.round(before)}</span>
                  <span className="text-amber-200/40">→</span>
                  <span className="text-amber-50">{Math.round(after)}</span>
                </div>
                <div className={`text-[10px] ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-amber-200/40"}`}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function summarize(exp: LifeExperiment, lang: "zh" | "en"): string {
  const parts: string[] = [];
  const all: Record<string, number> = { ...exp.dimensionEffects, ...exp.costEffects };
  const sorted = Object.entries(all).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  for (const [k, v] of sorted) {
    const label = DIMENSION_LABELS[k as keyof typeof DIMENSION_LABELS][lang];
    parts.push(`${label} ${v > 0 ? "+" : ""}${v}`);
  }
  return parts.join(" · ");
}
