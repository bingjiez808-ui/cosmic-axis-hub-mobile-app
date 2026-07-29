import { useEffect, useMemo, useRef, useState } from "react";

import { useLang } from "@/lib/i18n";

import { MainChartGate, type GateState } from "@/experiences/life-studies/MainChartGate";
import { GenerationMethod } from "@/experiences/life-studies/GenerationMethod";
import { seedForChart } from "@/experiences/life-studies/math/MathLifeModel";
import { BookmarkStrip, useSelectedBookmark } from "./BookmarkStrip";
import { ExperimentLab } from "./ExperimentLab";
import { LifeFunctionChart } from "./LifeFunctionChart";
import { YearlyRadar } from "./YearlyRadar";
import { bookmarkById } from "./bookmarks";
import { experimentById } from "./experiments";
import { computeLifeMath } from "./computeSeries";
import { AGE_PHASES, type LifeDimensionKey } from "./types";

const BRANCH_KEY = "fate.math.branches.v1";
const FOCUS_KEY  = "fate.math.focusAge.v1";

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
  const [focusAge, setFocusAge] = useState<number>(30);
  const [highlightDim, setHighlightDim] = useState<LifeDimensionKey | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const radarRef = useRef<HTMLDivElement | null>(null);
  const experimentRef = useRef<HTMLDivElement | null>(null);
  const bookmarksRef = useRef<HTMLDivElement | null>(null);

  // Restore local UI state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BRANCH_KEY);
      if (raw) setSavedBranchIds(JSON.parse(raw));
      const f = window.localStorage.getItem(FOCUS_KEY);
      if (f) { const n = Number(f); if (!Number.isNaN(n)) setFocusAge(Math.min(80, Math.max(0, n))); }
    } catch { /* ignore */ }
    const mq = window.matchMedia?.("(max-width: 768px)");
    if (mq) {
      setIsMobile(mq.matches);
      const on = () => setIsMobile(mq.matches);
      mq.addEventListener?.("change", on);
      return () => mq.removeEventListener?.("change", on);
    }
  }, []);

  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem(FOCUS_KEY, String(focusAge)); } catch { /* ignore */ }
  }, [focusAge]);

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

  const focusPoint = useMemo(
    () => computed.points.find((p) => p.age === focusAge) ?? computed.points[Math.floor(computed.points.length / 2)] ?? null,
    [computed.points, focusAge],
  );

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

  const minAge = computed.points[0]?.age ?? 0;
  const maxAge = computed.points[computed.points.length - 1]?.age ?? 80;

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      {/* 1. Opening */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "开篇" : "Start here"}
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-snug text-amber-50 md:text-3xl">
          {isZh ? "把人生写成七条会共振的函数" : "Write life as seven resonant functions"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-100/85 md:text-base">
          {isZh
            ? "这里不预测唯一结局, 而是把学业、事业、爱情、家庭、人际、财富、健康放进同一张坐标图, 观察不同阶段如何彼此推动或牵制。"
            : "This isn't a single-fate prediction. It plots study, career, love, family, social, wealth, and health on one grid so you can see how phases push or pull one another."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          {[
            { n: "01", zh: "读懂七维曲线", en: "Read the seven lines", onClick: () => scrollTo(chartRef) },
            { n: "02", zh: "停下看这一年", en: "Pause this year",      onClick: () => scrollTo(radarRef) },
            { n: "03", zh: "调一个变量",    en: "Change one variable",  onClick: () => scrollTo(experimentRef) },
            { n: "04", zh: "换一种理解",    en: "Try another reading",  onClick: () => scrollTo(bookmarksRef) },
          ].map((s) => (
            <button key={s.n} type="button" onClick={s.onClick}
              className="min-h-[44px] rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 px-3 py-2 text-left text-[12px] text-amber-100 hover:border-amber-400/35">
              <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/60">{s.n}</span>
              <div className="mt-0.5 text-amber-50">{isZh ? s.zh : s.en}</div>
            </button>
          ))}
        </div>
      </section>

      <MainChartGate state={gate} />

      {/* 2. Concise legend row (moved into chart; keep only phase quick-jumps) */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-100/80">
          <span className="uppercase tracking-[0.24em] text-amber-200/60">{isZh ? "跳转阶段" : "Jump to phase"}:</span>
          {AGE_PHASES.map((p) => (
            <button key={p.from} type="button"
              onClick={() => { setFocusAge(Math.min(maxAge, Math.max(minAge, p.from))); scrollTo(chartRef); }}
              className="min-h-7 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-0.5 text-[10.5px] text-amber-100/85 hover:border-amber-400/40">
              {p.from}–{p.to > 100 ? "…" : p.to} · {p.label[lang]}
            </button>
          ))}
        </div>
      </section>

      {/* Mode */}
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

      {/* 3. Main chart */}
      <div ref={chartRef} className="scroll-mt-32">
        <LifeFunctionChart
          points={computed.points}
          lang={lang}
          activeBookmarkRanges={previewRanges}
          hasExperiment={!!activeExperiment}
          focusAge={focusAge}
          onFocusAge={(a) => { setFocusAge(a); }}
          highlightDim={compareMode ? highlightDim : null}
          onHighlightDim={(d) => setHighlightDim(d)}
          isMobile={isMobile}
        />
      </div>

      {/* 4. Yearly radar */}
      <div ref={radarRef} className="scroll-mt-32">
        <YearlyRadar
          point={focusPoint}
          onSelectAge={(a) => setFocusAge(Math.min(maxAge, Math.max(minAge, a)))}
          onAxisClick={(d) => { setHighlightDim(d); scrollTo(chartRef); }}
          onBackToChart={() => scrollTo(chartRef)}
          minAge={minAge}
          maxAge={maxAge}
          lang={lang}
        />
      </div>

      {/* 5. Experiment lab */}
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

      {/* 6. Key inflection notes */}
      {computed.keyEvents.length > 0 && (
        <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
              {isZh ? "关键波动提示" : "Key inflection notes"}
            </div>
            <span className="text-[10px] text-amber-200/50">
              {isZh ? "点击卡片跳到该年份" : "Tap a card to jump to that year"}
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {computed.keyEvents.map((age) => {
              const p = computed.points.find((x) => x.age === age);
              if (!p?.shortHint) return null;
              return (
                <li key={age}>
                  <button type="button"
                    onClick={() => { setFocusAge(age); scrollTo(chartRef); }}
                    data-testid={`key-event-${age}`}
                    className="w-full text-left rounded-lg border border-amber-400/15 bg-[#0f0f1a]/70 p-3 text-[12px] text-amber-100/85 hover:border-amber-400/35">
                    <div className="text-amber-50">{isZh ? `${age} 岁附近` : `Around age ${age}`}</div>
                    <p className="mt-1 leading-relaxed">{p.shortHint[lang]}</p>
                    {p.caution && (
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                        <span className="text-amber-50">{isZh ? "提醒: " : "Reminder: "}</span>{p.caution[lang]}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 7. Bookmarks */}
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
