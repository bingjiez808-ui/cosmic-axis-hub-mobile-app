import { useEffect, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";
import {
  AGE_PHASES,
  DIMENSION_COLORS,
  DIMENSION_DESCRIPTIONS,
  DIMENSION_LABELS,
  DIMENSION_MARKERS,
  LIFE_DIMENSIONS,
  phaseForAge,
  type LifeDimensionKey,
  type LifeMathPoint,
} from "./types";

export type ViewMode = "seven" | "composite" | "compare";

type QuickCombo = { id: string; zh: string; en: string; dims: LifeDimensionKey[] | "all" | "none" };
const QUICK_COMBOS: QuickCombo[] = [
  { id: "overview",   zh: "只看总览",       en: "Overview only",       dims: "none" },
  { id: "career",     zh: "只看事业",       en: "Career only",         dims: ["career"] },
  { id: "cw",         zh: "事业 + 财富",     en: "Career + Wealth",     dims: ["career", "wealth"] },
  { id: "lf",         zh: "爱情 + 家庭",     en: "Love + Family",       dims: ["love", "family"] },
  { id: "all",        zh: "全部七条",       en: "All seven",           dims: "all" },
];

const FILTER_KEY = "fate.math.filter.v1";

function loadFilter(): { mode: ViewMode; visible: LifeDimensionKey[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    return p;
  } catch { return null; }
}

function saveFilter(v: { mode: ViewMode; visible: LifeDimensionKey[] }) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(FILTER_KEY, JSON.stringify(v));
  } catch { /* ignore */ }
}

function Marker({ x, y, kind, color }: { x: number; y: number; kind: string; color: string }) {
  switch (kind) {
    case "circle":   return <circle cx={x} cy={y} r={2.4} fill={color} />;
    case "triangle": return <polygon points={`${x},${y - 2.8} ${x - 2.6},${y + 2.2} ${x + 2.6},${y + 2.2}`} fill={color} />;
    case "diamond":  return <polygon points={`${x},${y - 2.8} ${x + 2.6},${y} ${x},${y + 2.8} ${x - 2.6},${y}`} fill={color} />;
    case "square":   return <rect x={x - 2.2} y={y - 2.2} width={4.4} height={4.4} fill={color} />;
    case "pentagon": return <polygon points={`${x},${y - 2.8} ${x + 2.6},${y - 0.8} ${x + 1.6},${y + 2.4} ${x - 1.6},${y + 2.4} ${x - 2.6},${y - 0.8}`} fill={color} />;
    case "hexagon":  return <polygon points={`${x + 2.6},${y} ${x + 1.3},${y + 2.4} ${x - 1.3},${y + 2.4} ${x - 2.6},${y} ${x - 1.3},${y - 2.4} ${x + 1.3},${y - 2.4}`} fill={color} />;
    case "plus":     return <path d={`M${x - 2.6},${y} L${x + 2.6},${y} M${x},${y - 2.6} L${x},${y + 2.6}`} stroke={color} strokeWidth={1.4} />;
    default:         return null;
  }
}

export function LifeFunctionChart({
  points,
  lang,
  activeBookmarkRanges,
  hasExperiment,
  focusAge,
  onFocusAge,
  highlightDim,
  onHighlightDim,
  isMobile = false,
}: {
  points: LifeMathPoint[];
  lang: "zh" | "en";
  activeBookmarkRanges?: Array<[number, number]>;
  hasExperiment: boolean;
  focusAge: number;
  onFocusAge: (age: number) => void;
  highlightDim: LifeDimensionKey | null;
  onHighlightDim: (d: LifeDimensionKey | null) => void;
  isMobile?: boolean;
}) {
  const isZh = lang === "zh";
  const reduce = useReducedMotion();

  const initial = loadFilter();
  const [mode, setMode] = useState<ViewMode>(initial?.mode ?? (isMobile ? "composite" : "seven"));
  const [visible, setVisible] = useState<Set<LifeDimensionKey>>(() => {
    if (initial?.visible?.length) return new Set(initial.visible);
    if (isMobile) return new Set<LifeDimensionKey>(["career", "health"]);
    return new Set<LifeDimensionKey>(LIFE_DIMENSIONS);
  });
  const [hoveredLine, setHoveredLine] = useState<LifeDimensionKey | "current" | "baseline" | "experiment" | null>(null);
  const [openDim, setOpenDim] = useState<LifeDimensionKey | null>(null);

  useEffect(() => { saveFilter({ mode, visible: Array.from(visible) }); }, [mode, visible]);

  const width = 860;
  const height = 340;
  const padL = 46;
  const padR = 96;
  const padT = 30;
  const padB = 42;

  const view = useMemo(() => {
    if (points.length === 0) return null;
    const minAge = points[0].age;
    const maxAge = points[points.length - 1].age;
    const span = Math.max(1, maxAge - minAge);
    const sx = (a: number) => padL + ((a - minAge) / span) * (width - padL - padR);
    const sy = (v: number) => padT + (1 - v / 100) * (height - padT - padB);
    const buildLine = (get: (p: LifeMathPoint) => number) =>
      points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.age).toFixed(1)},${sy(get(p)).toFixed(1)}`).join(" ");
    const dimPaths = {} as Record<LifeDimensionKey, string>;
    for (const d of LIFE_DIMENSIONS) dimPaths[d] = buildLine((p) => p.dimensions[d]);
    return {
      minAge, maxAge, sx, sy,
      dimPaths,
      baselinePath: buildLine((p) => p.baseline),
      currentPath:  buildLine((p) => p.currentPath),
      experimentPath: buildLine((p) => p.experimentPath),
    };
  }, [points]);

  if (!view) return null;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const handleMove = (clientX: number) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / (rect.width / width);
    const span = Math.max(1, view.maxAge - view.minAge);
    const age = Math.round(view.minAge + ((px - padL) / (width - padL - padR)) * span);
    onFocusAge(Math.max(view.minAge, Math.min(view.maxAge, age)));
  };

  const focusPoint = points.find((p) => p.age === focusAge) ?? null;
  const focusX = view.sx(focusAge);

  const activateCombo = (combo: QuickCombo) => {
    if (combo.dims === "none") { setMode("composite"); return; }
    setMode("seven");
    if (combo.dims === "all") setVisible(new Set(LIFE_DIMENSIONS));
    else setVisible(new Set(combo.dims));
  };

  const toggleDim = (d: LifeDimensionKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        if (next.size <= 1) return next; // guard: keep at least one
        next.delete(d);
      } else next.add(d);
      return next;
    });
    if (mode !== "seven") setMode("seven");
  };

  const dimVisible = (d: LifeDimensionKey) => mode === "seven" ? visible.has(d) : mode === "composite" ? true : (highlightDim === d);
  const dimOpacity = (d: LifeDimensionKey) => {
    if (mode === "composite") return 0.14;
    if (mode === "compare")   return highlightDim === d ? 1 : 0.12;
    if (!visible.has(d))      return 0;
    if (hoveredLine && hoveredLine !== d) return 0.18;
    if (highlightDim && highlightDim !== d) return 0.35;
    return 1;
  };

  const showComposite = mode === "composite" || mode === "compare";
  const compositeOpacity = (k: "current" | "baseline" | "experiment") => {
    if (!showComposite) return 0;
    if (k === "experiment" && !hasExperiment) return 0;
    if (hoveredLine && hoveredLine !== k) return 0.35;
    return 1;
  };

  const eventEvents = useMemo(
    () => points.filter((p) => p.eventType).slice(0, isMobile ? 3 : 5),
    [points, isMobile],
  );

  const focusSummary = useMemo(() => {
    if (!focusPoint) return null;
    const dims = LIFE_DIMENSIONS.map((d) => ({ d, v: focusPoint.dimensions[d], delta: focusPoint.dimensions[d] - focusPoint.dimensionBaselines[d] }));
    const up   = [...dims].sort((a, b) => b.delta - a.delta).slice(0, 2);
    const down = [...dims].sort((a, b) => a.delta - b.delta).slice(0, 1);
    return { dims, up, down };
  }, [focusPoint]);

  return (
    <div className="rounded-2xl border border-amber-400/15 bg-[#08080f]/80 p-3 md:p-4">
      {/* Mode segmented control */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={isZh ? "视图模式" : "View mode"} className="inline-flex overflow-hidden rounded-full border border-amber-400/30 text-[11px]">
          {(["seven", "composite", "compare"] as ViewMode[]).map((m) => {
            const disabled = m === "compare" && !hasExperiment;
            const label = m === "seven" ? (isZh ? "七维领域" : "Seven dims") :
                          m === "composite" ? (isZh ? "综合总览" : "Composite") :
                          (isZh ? "实验对照" : "Experiment vs current");
            return (
              <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={disabled}
                data-testid={`math-view-${m}`}
                onClick={() => setMode(m)}
                className={`min-h-9 px-3 ${mode === m ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                {label}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-amber-200/50">
          {isZh ? "点击图例可显示/隐藏; 悬停曲线查看数值与提示" : "Tap legend to toggle; hover a line for values & hints"}
        </span>
      </div>

      {/* Quick combos */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_COMBOS.map((c) => (
          <button key={c.id} type="button"
            onClick={() => activateCombo(c)}
            data-testid={`combo-${c.id}`}
            className="min-h-7 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-0.5 text-[10px] text-amber-100/85 hover:border-amber-400/40">
            {isZh ? c.zh : c.en}
          </button>
        ))}
      </div>

      {/* Seven-dim legend */}
      <div role="group" aria-label={isZh ? "七维图例" : "Seven dimension legend"} className="mb-2 flex flex-wrap items-center gap-1.5">
        {LIFE_DIMENSIONS.map((d) => {
          const on = mode === "seven" ? visible.has(d) : mode === "compare" ? highlightDim === d : false;
          return (
            <button key={d} type="button"
              onClick={() => toggleDim(d)}
              onMouseEnter={() => setHoveredLine(d)}
              onMouseLeave={() => setHoveredLine(null)}
              onFocus={() => setHoveredLine(d)}
              onBlur={() => setHoveredLine(null)}
              aria-pressed={on}
              data-testid={`dim-legend-${d}`}
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-[10.5px] transition ${
                on ? "border-amber-400/40 bg-amber-400/10 text-amber-50" : "border-white/10 text-amber-200/45"
              }`}>
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke={DIMENSION_COLORS[d]} strokeWidth={on ? 2.5 : 1.5} strokeLinecap="round" />
              </svg>
              {DIMENSION_LABELS[d][lang]}
            </button>
          );
        })}
      </div>

      {/* Axis captions */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-amber-200/50">
        <span>{isZh ? "纵轴: 领域状态指数 0–100 (50 = 长期基准)" : "Y: domain state index 0–100 (50 = long-run baseline)"}</span>
        <span>{isZh ? "横轴: 年龄 / 人生阶段" : "X: age / life phase"}</span>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label={isZh ? "七维人生函数主图" : "Seven-dimension life-function chart"}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[420px] cursor-crosshair select-none"
        onMouseMove={(e) => handleMove(e.clientX)}
        onTouchMove={(e) => { const t = e.touches[0]; if (t) handleMove(t.clientX); }}
      >
        {/* Age phase bands */}
        {AGE_PHASES.map((phase) => {
          if (phase.to < view.minAge || phase.from > view.maxAge) return null;
          const x1 = view.sx(Math.max(phase.from, view.minAge));
          const x2 = view.sx(Math.min(phase.to, view.maxAge));
          return (
            <g key={phase.from}>
              <rect x={x1} y={padT} width={Math.max(0, x2 - x1)} height={height - padT - padB} fill="rgba(252,211,77,0.02)" />
              <text x={(x1 + x2) / 2} y={padT + 10} fontSize="9" fill="rgba(252,211,77,0.32)" textAnchor="middle">{phase.label[lang]}</text>
            </g>
          );
        })}

        {/* Bookmark ranges (subtle in seven view, band in composite) */}
        {activeBookmarkRanges?.map(([a, b], i) => (
          <rect key={`bm-${i}`}
            x={view.sx(a)}
            y={padT}
            width={Math.max(4, view.sx(b) - view.sx(a))}
            height={height - padT - padB}
            fill={mode === "seven" ? "rgba(96,165,250,0.05)" : "rgba(96,165,250,0.10)"}
            stroke="rgba(96,165,250,0.30)"
            strokeDasharray="2 3"
          />
        ))}

        {/* Y grid */}
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={view.sy(t)} y2={view.sy(t)}
              stroke={t === 50 ? "rgba(252,211,77,0.22)" : "rgba(252,211,77,0.06)"}
              strokeDasharray={t === 50 ? "2 4" : undefined} />
            <text x={padL - 6} y={view.sy(t)} fill="rgba(252,211,77,0.5)" fontSize="9" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}

        {/* X ticks */}
        {[view.minAge, 20, 40, 60, view.maxAge].map((a) => (
          <text key={a} x={view.sx(a)} y={height - 18} fontSize="10" fill="rgba(252,211,77,0.55)" textAnchor="middle">{a}</text>
        ))}

        {/* Composite lines (baseline dashed, current solid, experiment dashed) */}
        {showComposite && (
          <>
            <path d={view.baselinePath} fill="none" stroke="#fef3c7" strokeOpacity={compositeOpacity("baseline") * 0.7} strokeWidth={2.4} strokeDasharray="4 4"
              onMouseEnter={() => setHoveredLine("baseline")} onMouseLeave={() => setHoveredLine(null)}
              data-testid="composite-baseline" />
            <path d={view.currentPath} fill="none" stroke="#f59e0b" strokeOpacity={compositeOpacity("current")} strokeWidth={2.6}
              onMouseEnter={() => setHoveredLine("current")} onMouseLeave={() => setHoveredLine(null)}
              data-testid="composite-current" />
            {hasExperiment && (
              <path d={view.experimentPath} fill="none" stroke="#22d3ee" strokeOpacity={compositeOpacity("experiment")} strokeWidth={2.4} strokeDasharray="6 4"
                onMouseEnter={() => setHoveredLine("experiment")} onMouseLeave={() => setHoveredLine(null)}
                data-testid="composite-experiment" />
            )}
          </>
        )}

        {/* Seven-dim lines */}
        {LIFE_DIMENSIONS.map((d) => {
          const op = dimOpacity(d);
          if (op === 0) return null;
          const isHi = hoveredLine === d || highlightDim === d;
          return (
            <g key={d}>
              <path
                d={view.dimPaths[d]}
                fill="none"
                stroke={DIMENSION_COLORS[d]}
                strokeWidth={isHi ? 3 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={op}
                style={reduce ? undefined : { transition: "opacity 220ms, stroke-width 220ms, d 600ms" }}
                onMouseEnter={() => setHoveredLine(d)}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={() => setOpenDim(d)}
                data-testid={`dim-line-${d}`}
              />
              {/* Sparse markers every ~10 years for legibility without color */}
              {isHi && points.filter((_, i) => i % 10 === 0).map((p) => (
                <Marker key={p.age} x={view.sx(p.age)} y={view.sy(p.dimensions[d])} kind={DIMENSION_MARKERS[d]} color={DIMENSION_COLORS[d]} />
              ))}
            </g>
          );
        })}

        {/* End labels */}
        {mode === "seven" && LIFE_DIMENSIONS.filter((d) => visible.has(d)).map((d, i, arr) => {
          const last = points[points.length - 1];
          const val = last.dimensions[d];
          const targetY = view.sy(val);
          const stagger = ((i - arr.length / 2) * 11);
          return (
            <g key={`end-${d}`}>
              <line x1={view.sx(last.age)} y1={targetY} x2={width - padR + 6} y2={targetY + stagger}
                stroke={DIMENSION_COLORS[d]} strokeOpacity={0.4} strokeWidth={1} />
              <text x={width - padR + 8} y={targetY + stagger} fontSize="9.5" fill={DIMENSION_COLORS[d]} dominantBaseline="middle">
                {DIMENSION_LABELS[d][lang]}
              </text>
            </g>
          );
        })}

        {/* Event markers */}
        {eventEvents.map((p) => {
          const y = view.sy(p.currentPath);
          const x = view.sx(p.age);
          const color = p.eventType === "risk" ? "#f87171" :
                        p.eventType === "low" ? "#facc15" :
                        p.eventType === "crossing" ? "#c4b5fd" :
                        p.eventType === "branch" ? "#22d3ee" :
                        p.eventType === "resonance" ? "#34d399" :
                        p.eventType === "tension" ? "#fb923c" : "#fde68a";
          return (
            <g key={`ev-${p.age}`} data-testid={`math-event-${p.age}`}
               onClick={(e) => { e.stopPropagation(); onFocusAge(p.age); }}
               style={{ cursor: "pointer" }}>
              <circle cx={x} cy={y - 12} r={4.2} fill="none" stroke={color} strokeWidth={1.4} />
              <text x={x} y={y - 15} fontSize="8" fill={color} textAnchor="middle">{p.age}</text>
            </g>
          );
        })}

        {/* Focus vertical cursor + per-dim markers at focus */}
        <line x1={focusX} x2={focusX} y1={padT} y2={height - padB} stroke="rgba(252,211,77,0.5)" strokeDasharray="2 3" />
        {focusPoint && mode === "seven" && LIFE_DIMENSIONS.filter((d) => visible.has(d)).map((d) => (
          <circle key={`fp-${d}`} cx={focusX} cy={view.sy(focusPoint.dimensions[d])} r={3.2}
            fill={DIMENSION_COLORS[d]} stroke="#08080f" strokeWidth={1.2} />
        ))}
        {focusPoint && showComposite && (
          <circle cx={focusX} cy={view.sy(focusPoint.currentPath)} r={3.6} fill="#f59e0b" stroke="#08080f" strokeWidth={1.2} />
        )}
      </svg>

      {/* Focus summary + age slider */}
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div className="rounded-lg border border-amber-400/15 bg-[#0f0f1a]/70 px-3 py-2 text-[12px] text-amber-100/90" data-testid="focus-summary">
          {focusPoint && focusSummary ? (
            <>
              <span className="font-serif text-amber-50">{focusAge} {isZh ? `岁 · ${phaseForAge(focusAge).label.zh}` : `· ${phaseForAge(focusAge).label.en}`}</span>
              <span className="mx-2 text-amber-200/40">·</span>
              <span>{isZh ? "综合指数" : "Composite"}: <span className="font-mono text-amber-200">{focusPoint.currentPath.toFixed(1)}</span></span>
              <span className="mx-2 text-amber-200/40">·</span>
              <span>{isZh ? "主要推动" : "Pushed by"}: {focusSummary.up.map(u => DIMENSION_LABELS[u.d][lang]).join(" / ")}</span>
              <span className="mx-2 text-amber-200/40">·</span>
              <span>{isZh ? "主要摩擦" : "Friction"}: {focusSummary.down.map(u => DIMENSION_LABELS[u.d][lang]).join(" / ")}</span>
            </>
          ) : (isZh ? "拖动下方滑杆或点击图上任意年龄" : "Drag the slider below or click any age on the chart")}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <label className="text-[11px] text-amber-200/70">{isZh ? "年龄游标" : "Age cursor"}</label>
        <input
          type="range"
          min={view.minAge}
          max={view.maxAge}
          value={focusAge}
          onChange={(e) => onFocusAge(Number(e.target.value))}
          aria-label={isZh ? "年龄游标" : "Age cursor"}
          className="flex-1 accent-amber-400"
          data-testid="age-slider"
        />
        <span className="w-10 text-right font-mono text-[11px] text-amber-200">{focusAge}</span>
      </div>

      {/* Domain description sheet */}
      {openDim && (
        <div className="mt-3 rounded-lg border border-amber-400/25 bg-[#0f0f1a]/90 p-3 text-[12px] text-amber-100/90" data-testid={`dim-detail-${openDim}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: DIMENSION_COLORS[openDim] }} />
              <span className="font-serif text-sm text-amber-50">{DIMENSION_LABELS[openDim][lang]}</span>
            </div>
            <button type="button" onClick={() => setOpenDim(null)} className="rounded border border-amber-400/30 px-2 py-0.5 text-[10px] text-amber-100/80">
              {isZh ? "关闭" : "Close"}
            </button>
          </div>
          <p className="mt-2 leading-relaxed">
            <span className="text-amber-50">{isZh ? "这条线观察: " : "This line reads: "}</span>
            {DIMENSION_DESCRIPTIONS[openDim].reads[lang]}
          </p>
          <p className="mt-1 leading-relaxed text-amber-200/75">
            <span className="text-amber-50">{isZh ? "它不代表: " : "It does not: "}</span>
            {DIMENSION_DESCRIPTIONS[openDim].notReads[lang]}
          </p>
          <p className="mt-1 leading-relaxed text-amber-200/70">
            <span className="text-amber-50">{isZh ? "联动最明显: " : "Most coupled with: "}</span>
            {DIMENSION_DESCRIPTIONS[openDim].coupled.map((c) => DIMENSION_LABELS[c][lang]).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button"
              onClick={() => { setVisible(new Set([openDim])); setMode("seven"); }}
              className="min-h-8 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 text-[11px] text-amber-50">
              {isZh ? "只看这条线" : "Show only this"}
            </button>
            <button type="button"
              onClick={() => { onHighlightDim(openDim); setMode("compare"); }}
              disabled={!hasExperiment}
              className={`min-h-8 rounded-full border px-3 text-[11px] ${hasExperiment ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100" : "cursor-not-allowed border-white/10 text-white/30"}`}>
              {isZh ? "加入实验对照" : "Add to compare"}
            </button>
          </div>
        </div>
      )}

      {/* Event notes for the currently focused event, if any */}
      {focusPoint?.shortHint && (
        <div className="mt-3 rounded-lg border border-cyan-300/25 bg-[#0b1428]/70 p-3 text-[12px] text-amber-100/90" data-testid="focus-event">
          <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">
            {isZh ? "特殊波动" : "Key inflection"}
          </div>
          <p className="mt-1 leading-relaxed">{focusPoint.shortHint[lang]}</p>
          {focusPoint.caution && (
            <p className="mt-1 leading-relaxed text-amber-200/75">
              <span className="text-amber-50">{isZh ? "注意: " : "Caution: "}</span>{focusPoint.caution[lang]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
