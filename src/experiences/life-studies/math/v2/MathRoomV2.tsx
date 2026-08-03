import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Bookmark, ChevronRight, FlaskConical, Radar, Sparkles } from "lucide-react";

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
const ACTIVE_EXPERIMENT_KEY = "fate.math.activeExperiment.v1";
const FOCUS_KEY  = "fate.math.focusAge.v1";
type MathSectionTo =
  | "/life-studies/math/curve"
  | "/life-studies/math/year"
  | "/life-studies/math/lab"
  | "/life-studies/math/notes";

export function MathRoomV2({
  gate,
  primaryBirthISO,
  primaryName,
  primaryPlace,
  isSignedIn,
  loadingChart = false,
  view = "hub",
}: {
  gate: GateState;
  primaryBirthISO: string | null;
  primaryName: string | null;
  primaryPlace?: string | null;
  isSignedIn: boolean;
  loadingChart?: boolean;
  view?: "hub" | "curve" | "year" | "lab" | "notes";
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";

  const [mode, setMode] = useState<"demo" | "personal">(gate.kind === "ready" ? "personal" : "demo");
  const didAutoPersonal = useRef(false);
  useEffect(() => {
    if (gate.kind !== "ready" && mode === "personal") setMode("demo");
  }, [gate.kind, mode]);
  useEffect(() => {
    if (!loadingChart && gate.kind === "ready" && !didAutoPersonal.current) {
      didAutoPersonal.current = true;
      setMode("personal");
    }
  }, [gate.kind, loadingChart]);
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
      const active = window.localStorage.getItem(ACTIVE_EXPERIMENT_KEY);
      if (active && experimentById(active)) {
        setActiveExperimentId(active);
        setCompareMode(true);
      }
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
  const applyExperiment = (id: string | null) => {
    setActiveExperimentId(id);
    setCompareMode(!!id);
    try {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(ACTIVE_EXPERIMENT_KEY, id);
        else window.localStorage.removeItem(ACTIVE_EXPERIMENT_KEY);
      }
    } catch { /* ignore */ }
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const minAge = computed.points[0]?.age ?? 0;
  const maxAge = computed.points[computed.points.length - 1]?.age ?? 80;
  const sectionCards = [
    {
      icon: Activity,
      title: isZh ? "七维曲线" : "Seven-line curve",
      body: isZh ? "先看人生七个领域如何同时起伏，适合第一次进入。" : "See how seven domains rise and fall together.",
      to: "/life-studies/math/curve" as const,
      tag: isZh ? "主图" : "Chart",
    },
    {
      icon: Radar,
      title: isZh ? "这一年雷达" : "This-year radar",
      body: isZh ? "只聚焦某一年，查看事业、关系、健康等维度的相对状态。" : "Focus on one year and compare domains.",
      to: "/life-studies/math/year" as const,
      tag: isZh ? "聚焦" : "Focus",
    },
    {
      icon: FlaskConical,
      title: isZh ? "变量实验室" : "Variable lab",
      body: isZh ? "调一个选择变量，观察曲线如何变化，适合做行动前模拟。" : "Change one variable and compare the curve.",
      to: "/life-studies/math/lab" as const,
      tag: isZh ? "互动" : "Interactive",
    },
    {
      icon: Bookmark,
      title: isZh ? "波动与书签" : "Notes and bookmarks",
      body: isZh ? "查看关键波动年份，并换一种阅读角度理解同一张图。" : "Browse key ages and switch reading lenses.",
      to: "/life-studies/math/notes" as const,
      tag: isZh ? "整理" : "Review",
    },
  ];
  const modeControl = (
    <section className="rounded-[22px] border border-amber-400/15 bg-[#0b0b14]/70 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">{isZh ? "数据模式" : "Data mode"}</span>
        {loadingChart ? (
          <span className="rounded-full border border-teal-300/20 bg-teal-300/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-teal-100/70">
            {isZh ? "读取中" : "Loading"}
          </span>
        ) : mode === "demo" && (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
            {isZh ? "演示" : "Demo"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" data-testid="math-mode-demo" onClick={() => setMode("demo")}
          className={`min-h-10 rounded-2xl border px-3 text-xs ${mode === "demo" ? "border-amber-300/45 bg-amber-300/16 text-amber-50" : "border-white/10 text-amber-200/70"}`}>
          {isZh ? "演示命盘" : "Demo chart"}
        </button>
        <button type="button" data-testid="math-mode-personal"
          onClick={() => gate.kind === "ready" && setMode("personal")}
          disabled={gate.kind !== "ready"}
          className={`min-h-10 rounded-2xl border px-3 text-xs ${mode === "personal" ? "border-amber-300/45 bg-amber-300/16 text-amber-50" : "border-white/10 text-amber-200/70"} ${gate.kind !== "ready" ? "cursor-not-allowed opacity-55" : ""}`}>
          {isZh ? "我的主命盘" : "My chart"}
        </button>
      </div>
      {mode === "personal" && primaryName ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200/60">
          {isZh
            ? `当前使用: ${primaryName}${primaryBirthISO ? ` · ${primaryBirthISO}` : ""}${primaryPlace ? ` · ${primaryPlace}` : ""}`
            : `Using: ${primaryName}${primaryBirthISO ? ` · ${primaryBirthISO}` : ""}${primaryPlace ? ` · ${primaryPlace}` : ""}`}
        </p>
      ) : null}
      {!isSignedIn ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-100/45">
          {isZh ? "未登录时会使用演示数据，不会写入账户。" : "Signed-out mode uses demo data and saves nothing."}
        </p>
      ) : null}
      {isSignedIn && gate.kind !== "ready" && !loadingChart ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-100/45">
          {isZh ? "如果你已经有命盘，请先在「命盘」页设为主命盘。" : "If you already have a chart, set it as primary on the Chart page first."}
        </p>
      ) : null}
    </section>
  );

  if (view === "hub") {
    return (
      <div className="grid grid-cols-1 gap-4">
        <section className="relative overflow-hidden rounded-[28px] border border-amber-400/15 bg-gradient-to-br from-amber-300/12 via-[#0b0b14] to-teal-300/8 p-4">
          <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full border border-teal-200/10 math-orbit" />
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/65">
            <Sparkles aria-hidden className="h-4 w-4 text-amber-300" />
            {isZh ? "数学馆路径" : "Math path"}
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-amber-50">
            {isZh ? "先选一个数学工具，不必一次读完整座馆。" : "Pick one tool. No need to read the whole room."}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/62">
            {isZh ? "数学馆把命盘转译成曲线、年份雷达、变量实验和波动书签。每次只进入一个功能，读完再返回。" : "Math translates the chart into curves, radar, experiments and bookmarks. Enter one tool at a time."}
          </p>
        </section>

        <MainChartGate state={gate} />

        <section className="grid gap-2">
          {sectionCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              data-testid={`math-section-${card.to.split("/").pop()}`}
              className="group flex min-h-[104px] w-full items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-3 text-left transition active:scale-[0.985]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/24 text-amber-200">
                <card.icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-base font-semibold text-amber-50">{card.title}</span>
                  <span className="rounded-full border border-teal-300/18 bg-teal-300/[0.055] px-2 py-0.5 text-[10px] text-teal-100/72">{card.tag}</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-amber-100/55">{card.body}</span>
              </span>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-amber-100/35 transition group-active:translate-x-0.5" />
            </Link>
          ))}
        </section>

        {modeControl}

        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .math-orbit { animation: math-orbit 18s linear infinite; }
            @keyframes math-orbit {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <MainChartGate state={gate} />

      <section className="rounded-[24px] border border-amber-400/15 bg-[#0b0b14]/75 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
            {isZh ? "数学馆功能" : "Math tools"}
          </span>
          <Link
            to="/life-studies/math"
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-amber-100/70 active:scale-95"
          >
            {isZh ? "返回馆页" : "Hub"}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sectionCards.map((card) => {
            const isActive =
              (view === "curve" && card.to.endsWith("/curve")) ||
              (view === "year" && card.to.endsWith("/year")) ||
              (view === "lab" && card.to.endsWith("/lab")) ||
              (view === "notes" && card.to.endsWith("/notes"));
            return (
              <Link
                key={card.to}
                to={card.to as MathSectionTo}
                aria-pressed={isActive}
                data-testid={`math-tab-${card.to.split("/").pop()}`}
                className={`min-h-[58px] rounded-2xl border px-3 text-left transition active:scale-[0.98] ${
                  isActive
                    ? "border-amber-300/45 bg-amber-300/16 text-amber-50 shadow-[0_0_24px_rgba(245,197,87,0.08)]"
                    : "border-white/10 bg-white/[0.035] text-amber-100/68"
                }`}
              >
                <span className="flex items-center gap-2">
                  <card.icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-semibold">{card.title}</span>
                </span>
                <span className="mt-1 block text-[10px] text-amber-100/45">{card.tag}</span>
              </Link>
            );
          })}
        </div>
      </section>

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

      {modeControl}

      {/* 3. Main chart */}
      {view === "curve" ? <div ref={chartRef} className="scroll-mt-32">
        {activeExperiment ? (
          <section className="mb-3 rounded-[22px] border border-cyan-300/25 bg-cyan-300/[0.075] p-3" data-testid="curve-active-experiment">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/65">
                  {isZh ? "变量已接入主图" : "Experiment applied"}
                </div>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{activeExperiment.title[lang]}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-cyan-50/65">
                  {isZh
                    ? `青绿色分支会从 ${activeExperiment.startAge} 岁开始显示对照变化。`
                    : `The cyan branch starts from age ${activeExperiment.startAge} as a comparison path.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyExperiment(null)}
                className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-cyan-50/75 active:scale-95"
              >
                {isZh ? "清除" : "Clear"}
              </button>
            </div>
          </section>
        ) : null}
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
      </div> : null}

      {/* 4. Yearly radar */}
      {view === "year" ? <div ref={radarRef} className="scroll-mt-32">
        <YearlyRadar
          point={focusPoint}
          onSelectAge={(a) => setFocusAge(Math.min(maxAge, Math.max(minAge, a)))}
          onAxisClick={(d) => { setHighlightDim(d); scrollTo(chartRef); }}
          onBackToChart={() => scrollTo(chartRef)}
          minAge={minAge}
          maxAge={maxAge}
          lang={lang}
        />
      </div> : null}

      {/* 5. Experiment lab */}
      {view === "lab" ? <div ref={experimentRef} className="scroll-mt-32">
        <ExperimentLab
          points={computed.points}
          activeExperimentId={activeExperimentId}
          onSelect={(id) => {
            applyExperiment(id);
          }}
          onUndo={() => { applyExperiment(null); }}
          onCompareToggle={() => setCompareMode((v) => !v)}
          compareMode={compareMode}
          onSaveBranch={handleSave}
          savedBranchIds={savedBranchIds}
          lang={lang}
        />
      </div> : null}

      {/* 6. Key inflection notes */}
      {view === "notes" && computed.keyEvents.length > 0 && (
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
      {view === "notes" ? <div ref={bookmarksRef} className="scroll-mt-32">
        <BookmarkStrip
          points={computed.points}
          selectedId={bookmarkId}
          hoveredId={hoveredBookmark}
          onSelect={setBookmarkId}
          onHover={setHoveredBookmark}
          lang={lang}
        />
      </div> : null}

      {view === "notes" ? <GenerationMethod /> : null}
    </div>
  );
}
