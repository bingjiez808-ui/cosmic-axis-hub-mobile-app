import { useEffect, useMemo, useRef, useState } from "react";

import { useLang } from "@/lib/i18n";

import { MainChartGate, type GateState } from "@/experiences/life-studies/MainChartGate";
import { GenerationMethod } from "@/experiences/life-studies/GenerationMethod";
import { seedForChart } from "@/experiences/life-studies/math/MathLifeModel";
import { BookmarkStrip, useSelectedBookmark } from "./BookmarkStrip";
import { ExperimentLab } from "./ExperimentLab";
import { LifeFunctionChart } from "./LifeFunctionChart";
import { bookmarkById } from "./bookmarks";
import { experimentById } from "./experiments";
import { computeLifeMath } from "./computeSeries";
import { AGE_PHASES } from "./types";

const BRANCH_KEY = "fate.math.branches.v1";

export function MathRoomV2({
  gate,
  primaryBirthISO,
  primaryName,
  isSignedIn,
}: {
  gate: GateState;
  primaryBirthISO: string | null;
  primaryName: string | null;
  isSignedIn: boolean;
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";

  const [mode, setMode] = useState<"demo" | "personal">(gate.kind === "ready" ? "personal" : "demo");
  useEffect(() => {
    if (gate.kind !== "ready" && mode === "personal") setMode("demo");
  }, [gate.kind, mode]);
  const seed = mode === "personal" && gate.kind === "ready" ? seedForChart(primaryBirthISO) : "demo:v1";

  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [savedBranchIds, setSavedBranchIds] = useState<string[]>([]);
  const [bookmarkId, setBookmarkId] = useSelectedBookmark();
  const [hoveredBookmark, setHoveredBookmark] = useState<string | null>(null);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const experimentRef = useRef<HTMLDivElement | null>(null);
  const bookmarksRef = useRef<HTMLDivElement | null>(null);

  // 恢复已保存分支
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BRANCH_KEY);
      if (raw) setSavedBranchIds(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // 有已保存分支时, 默认呈现最近一次
  useEffect(() => {
    if (activeExperimentId == null && savedBranchIds.length > 0) {
      setActiveExperimentId(savedBranchIds[savedBranchIds.length - 1]);
    }
  }, [savedBranchIds, activeExperimentId]);

  const activeExperiment = useMemo(() => experimentById(activeExperimentId ?? ""), [activeExperimentId]);
  const computed = useMemo(
    () => computeLifeMath({ mode, seed, experiment: activeExperiment }),
    [mode, seed, activeExperiment],
  );

  const previewBookmark = hoveredBookmark ?? bookmarkId;
  const previewRanges = useMemo(() => bookmarkById(previewBookmark).highlight(computed.points), [previewBookmark, computed.points]);

  const handleSave = () => {
    if (!activeExperimentId) return;
    setSavedBranchIds((prev) => {
      const next = prev.includes(activeExperimentId) ? prev : [...prev, activeExperimentId];
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(BRANCH_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      {/* 1. 开场与使用说明 */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "开篇" : "Start here"}
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-snug text-amber-50 md:text-3xl">
          {isZh ? "把人生写成一条会变化的函数" : "Write your life as a function that changes"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-100/85 md:text-base">
          {isZh
            ? "这里不预测唯一结局, 而是把学业、事业、关系、家庭、财富与健康放进同一张坐标图, 观察不同阶段如何彼此影响。"
            : "This isn't a single-fate prediction. It puts study, career, relationship, family, wealth, and health on one grid so you can see how phases interact."}
        </p>
        <p className="mt-2 max-w-3xl text-[13px] text-amber-100/70">
          {isZh
            ? "先读懂曲线, 再选择一种人生实验; 每次改变一个变量, 看看它会在哪个年龄改变你的路径。"
            : "First read the curve; then pick one life experiment. Change one variable and see at which age it shifts your path."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { n: "01", zh: "认识三条线", en: "Meet the three lines", onClick: () => scrollTo(chartRef) },
            { n: "02", zh: "选择一个变量", en: "Pick one variable",  onClick: () => scrollTo(experimentRef) },
            { n: "03", zh: "观察人生分支", en: "Watch the branches", onClick: () => scrollTo(chartRef) },
          ].map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={s.onClick}
              className="min-h-[44px] rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 px-3 py-2 text-left text-[12px] text-amber-100 hover:border-amber-400/35"
            >
              <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/60">{s.n}</span>
              <div className="mt-0.5 text-amber-50">{isZh ? s.zh : s.en}</div>
            </button>
          ))}
        </div>
      </section>

      <MainChartGate state={gate} />

      {/* 2. 图例 + 坐标说明 */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "坐标" : "Axes"}
            </div>
            <p className="mt-1 text-[12px] text-amber-100/85">
              {isZh ? "横轴: 年龄 / 人生阶段" : "X: age / life phase"}
              <br />
              {isZh ? "纵轴: 综合状态指数 0–100" : "Y: composite state index 0–100"}
              <br />
              <span className="text-amber-200/60">
                {isZh
                  ? "50 分是长期基准, 不代表及格或人生价值。"
                  : "50 is a personal long-run baseline — not a pass line or a verdict."}
              </span>
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "三条曲线" : "The three lines"}
            </div>
            <ul className="mt-1 space-y-1 text-[12px] text-amber-100/85">
              <li><span className="text-amber-50">{isZh ? "生命基线" : "Life baseline"}</span> — {isZh ? "长期节奏, 不代表无法改变。" : "your long-run rhythm — not immovable."}</li>
              <li><span className="text-amber-50">{isZh ? "现实路径" : "Current path"}</span> — {isZh ? "当前选择下更可能走出的那条。" : "the path you're more likely to walk today."}</li>
              <li><span className="text-amber-50">{isZh ? "实验分支" : "Experiment branch"}</span> — {isZh ? "改变一个条件后可能的另一种走法。" : "how it could shift if you change one condition."}</li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "年龄阶段" : "Age phases"}
            </div>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-amber-100/75">
              {AGE_PHASES.map((p) => (
                <li key={p.from} className="truncate">{p.from}–{p.to > 100 ? "…" : p.to} · {p.label[lang]}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Mode row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">{isZh ? "模式" : "Mode"}</span>
        <div className="inline-flex overflow-hidden rounded-full border border-amber-400/30">
          <button type="button" data-testid="math-mode-demo" onClick={() => setMode("demo")}
            className={`min-h-9 px-3 text-xs ${mode === "demo" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"}`}>
            {isZh ? "演示命盘" : "Demo chart"}
          </button>
          <button type="button" data-testid="math-mode-personal"
            onClick={() => gate.kind === "ready" && setMode("personal")}
            disabled={gate.kind !== "ready"}
            className={`min-h-9 border-l border-amber-400/20 px-3 text-xs ${mode === "personal" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"} ${gate.kind !== "ready" ? "cursor-not-allowed opacity-60" : ""}`}>
            {isZh ? "个性化 (我的主命盘)" : "Personalized (my chart)"}
          </button>
        </div>
        {mode === "demo" && (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
            {isZh ? "演示数据" : "Demo data"}
          </span>
        )}
        {mode === "personal" && primaryName && (
          <span className="text-[11px] text-amber-200/60">
            {isZh ? `种子: ${primaryName}` : `Seed: ${primaryName}`}
          </span>
        )}
        {!isSignedIn && (
          <span className="text-[10px] uppercase tracking-[0.24em] text-amber-200/50">
            {isZh ? "未登录 · 不会写入账户" : "Signed out · nothing is saved"}
          </span>
        )}
      </div>

      {/* 3. 主图 */}
      <div ref={chartRef} className="scroll-mt-32">
        <LifeFunctionChart
          points={computed.points}
          lang={lang}
          activeBookmarkRanges={previewRanges}
          compareMode={compareMode}
          hasExperiment={!!activeExperiment}
        />
      </div>

      {/* 4. 选择实验室 */}
      <div ref={experimentRef} className="scroll-mt-32">
        <ExperimentLab
          points={computed.points}
          activeExperimentId={activeExperimentId}
          onSelect={(id) => {
            setActiveExperimentId(id);
            setCompareMode(false);
            if (id) setTimeout(() => scrollTo(chartRef), 200);
          }}
          onUndo={() => { setActiveExperimentId(null); setCompareMode(false); }}
          onCompareToggle={() => setCompareMode((v) => !v)}
          compareMode={compareMode}
          onSaveBranch={handleSave}
          savedBranchIds={savedBranchIds}
          lang={lang}
        />
      </div>

      {/* 6. 关键波动提示 */}
      {computed.keyEvents.length > 0 && (
        <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4 md:p-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "关键波动提示" : "Key inflection notes"}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {computed.keyEvents.map((age) => {
              const p = computed.points.find((x) => x.age === age);
              if (!p?.shortHint) return null;
              return (
                <li key={age} className="rounded-lg border border-amber-400/15 bg-[#0f0f1a]/70 p-3 text-[12px] text-amber-100/85">
                  <div className="text-amber-50">{isZh ? `${age} 岁附近` : `Around age ${age}`}</div>
                  <p className="mt-1 leading-relaxed">{p.shortHint[lang]}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 7. 人生数学书签 */}
      <div ref={bookmarksRef} className="scroll-mt-32">
        <BookmarkStrip
          points={computed.points}
          selectedId={bookmarkId}
          hoveredId={hoveredBookmark}
          onSelect={setBookmarkId}
          onHover={setHoveredBookmark}
          lang={lang}
        />
      </div>

      <GenerationMethod />
    </div>
  );
}
