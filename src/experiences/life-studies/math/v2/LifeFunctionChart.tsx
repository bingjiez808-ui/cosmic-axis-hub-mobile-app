import { useEffect, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";
import {
  AGE_PHASES,
  DIMENSION_COLORS,
  DIMENSION_LABELS,
  LIFE_DIMENSIONS,
  phaseForAge,
  type LifeMathPoint,
} from "./types";

type LineKey = "baseline" | "currentPath" | "experimentPath";
const LINE_META: Record<LineKey, { color: string; dash: string; width: number; labelZh: string; labelEn: string }> = {
  baseline:       { color: "#fef3c7", dash: "0",   width: 3.0, labelZh: "生命基线", labelEn: "Life baseline" },
  currentPath:    { color: "#f59e0b", dash: "0",   width: 2.4, labelZh: "现实路径", labelEn: "Current path" },
  experimentPath: { color: "#22d3ee", dash: "6 4", width: 2.2, labelZh: "实验分支", labelEn: "Experiment branch" },
};

export function LifeFunctionChart({
  points,
  lang,
  activeBookmarkRanges,
  compareMode = false,
  hasExperiment,
  onSelectAge,
}: {
  points: LifeMathPoint[];
  lang: "zh" | "en";
  activeBookmarkRanges?: Array<[number, number]>;
  compareMode?: boolean;
  hasExperiment: boolean;
  onSelectAge?: (age: number) => void;
}) {
  const isZh = lang === "zh";
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState<Set<LineKey>>(new Set());
  const [hoveredLine, setHoveredLine] = useState<LineKey | null>(null);
  const [cursorAge, setCursorAge] = useState<number | null>(null);
  const [lockedAge, setLockedAge] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const width = 820;
  const height = 320;
  const padL = 44;
  const padR = 96;
  const padT = 28;
  const padB = 38;

  const view = useMemo(() => {
    if (points.length === 0) return null;
    const minAge = points[0].age;
    const maxAge = points[points.length - 1].age;
    const span = Math.max(1, maxAge - minAge);
    const sx = (a: number) => padL + ((a - minAge) / span) * (width - padL - padR);
    const sy = (v: number) => padT + (1 - v / 100) * (height - padT - padB);
    const paths: Record<LineKey, string> = { baseline: "", currentPath: "", experimentPath: "" };
    for (const key of Object.keys(paths) as LineKey[]) {
      paths[key] = points
        .map((p, i) => {
          const v = key === "experimentPath" ? (p.experimentPath ?? p.currentPath) : p[key];
          return `${i === 0 ? "M" : "L"}${sx(p.age).toFixed(1)},${sy(v).toFixed(1)}`;
        })
        .join(" ");
    }
    return { minAge, maxAge, sx, sy, paths };
  }, [points]);

  if (!view) return null;

  const showExperiment = hasExperiment && !hidden.has("experimentPath");
  const activeAge = lockedAge ?? cursorAge;
  const activePoint = activeAge != null ? points.find((p) => p.age === activeAge) ?? null : null;

  const lineOpacity = (k: LineKey) => {
    if (hidden.has(k)) return 0;
    if (k === "experimentPath" && !hasExperiment) return 0;
    if (compareMode && (k === "currentPath" || k === "experimentPath")) return 1;
    if (compareMode) return 0.25;
    if (hoveredLine && hoveredLine !== k) return 0.35;
    return 1;
  };

  const handleMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / (rect.width / width);
    const span = Math.max(1, view.maxAge - view.minAge);
    const age = Math.round(view.minAge + ((px - padL) / (width - padL - padR)) * span);
    const clamped = Math.max(view.minAge, Math.min(view.maxAge, age));
    setCursorAge(clamped);
  };

  const toggle = (k: LineKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const focusX = activeAge != null ? view.sx(activeAge) : null;

  return (
    <div className="rounded-2xl border border-amber-400/15 bg-[#08080f]/80 p-3 md:p-4">
      {/* Legend */}
      <div role="group" aria-label={isZh ? "曲线图例" : "Curve legend"} className="mb-2 flex flex-wrap items-center gap-2">
        {(Object.keys(LINE_META) as LineKey[]).map((k) => {
          const meta = LINE_META[k];
          const off = hidden.has(k) || (k === "experimentPath" && !hasExperiment);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              onMouseEnter={() => setHoveredLine(k)}
              onMouseLeave={() => setHoveredLine(null)}
              onFocus={() => setHoveredLine(k)}
              onBlur={() => setHoveredLine(null)}
              disabled={k === "experimentPath" && !hasExperiment}
              aria-pressed={!off}
              data-testid={`math-legend-${k}`}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-[11px] transition ${
                off
                  ? "border-white/10 text-white/30"
                  : "border-amber-400/25 bg-amber-400/5 text-amber-100 hover:bg-amber-400/10"
              }`}
            >
              <svg width="26" height="8" aria-hidden>
                <line
                  x1="0" y1="4" x2="26" y2="4"
                  stroke={meta.color}
                  strokeWidth={meta.width}
                  strokeDasharray={meta.dash}
                  strokeLinecap="round"
                />
              </svg>
              {isZh ? meta.labelZh : meta.labelEn}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] text-amber-200/40">
          {isZh ? "点击图例可显示/隐藏; 悬停或按 Tab 高亮对应曲线" : "Tap legend to toggle; hover or Tab to spotlight a line"}
        </span>
      </div>

      {/* Axis captions */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-amber-200/50">
        <span>{isZh ? "纵轴: 综合状态指数 0–100 (50 = 你的长期基准)" : "Y: composite index 0–100 (50 = your long-run baseline)"}</span>
        <span>{isZh ? "横轴: 年龄 / 人生阶段" : "X: age / life phase"}</span>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label={isZh ? "人生函数主图" : "Life function main chart"}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[420px] cursor-crosshair select-none"
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setCursorAge(null)}
        onClick={(e) => {
          handleMove(e.clientX);
          const age = cursorAge;
          if (age != null) {
            setLockedAge((prev) => (prev === age ? null : age));
            onSelectAge?.(age);
          }
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) handleMove(t.clientX);
        }}
      >
        {/* Age phase bands */}
        {AGE_PHASES.map((phase) => {
          if (phase.to < view.minAge || phase.from > view.maxAge) return null;
          const x1 = view.sx(Math.max(phase.from, view.minAge));
          const x2 = view.sx(Math.min(phase.to, view.maxAge));
          return (
            <g key={phase.from}>
              <rect x={x1} y={padT} width={Math.max(0, x2 - x1)} height={height - padT - padB} fill="rgba(252,211,77,0.025)" />
              <text x={(x1 + x2) / 2} y={padT + 10} fontSize="9" fill="rgba(252,211,77,0.35)" textAnchor="middle">
                {isZh ? phase.label.zh : phase.label.en}
              </text>
            </g>
          );
        })}

        {/* Bookmark highlight bands */}
        {activeBookmarkRanges?.map(([a, b], i) => (
          <rect
            key={`bm-${i}`}
            x={view.sx(a)}
            y={padT}
            width={Math.max(4, view.sx(b) - view.sx(a))}
            height={height - padT - padB}
            fill="rgba(96,165,250,0.10)"
            stroke="rgba(96,165,250,0.35)"
            strokeDasharray="2 3"
          />
        ))}

        {/* Y grid */}
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={view.sy(t)} y2={view.sy(t)} stroke={t === 50 ? "rgba(252,211,77,0.22)" : "rgba(252,211,77,0.06)"} strokeDasharray={t === 50 ? "2 4" : undefined} />
            <text x={padL - 6} y={view.sy(t)} fill="rgba(252,211,77,0.5)" fontSize="9" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}

        {/* X age ticks */}
        {[view.minAge, 20, 40, 60, view.maxAge].map((a) => (
          <text key={a} x={view.sx(a)} y={height - 14} fontSize="10" fill="rgba(252,211,77,0.55)" textAnchor="middle">{a}</text>
        ))}

        {/* Lines */}
        {(["baseline", "currentPath", "experimentPath"] as LineKey[]).map((k) => {
          const meta = LINE_META[k];
          const op = lineOpacity(k);
          if (op === 0) return null;
          return (
            <path
              key={k}
              d={view.paths[k]}
              fill="none"
              stroke={meta.color}
              strokeWidth={hoveredLine === k ? meta.width + 1 : meta.width}
              strokeDasharray={meta.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={op}
              style={reduce ? undefined : { transition: "opacity 220ms, stroke-width 220ms, d 600ms" }}
              data-testid={`math-line-${k}`}
            />
          );
        })}

        {/* End labels */}
        {(["baseline", "currentPath", "experimentPath"] as LineKey[]).map((k, idx) => {
          if (hidden.has(k) || (k === "experimentPath" && !hasExperiment)) return null;
          const last = points[points.length - 1];
          const val = k === "experimentPath" ? (last.experimentPath ?? last.currentPath) : last[k];
          const meta = LINE_META[k];
          // Basic vertical stagger to avoid overlap
          const y = view.sy(val) + (idx - 1) * 10;
          return (
            <g key={`lbl-${k}`}>
              <line x1={view.sx(last.age)} y1={view.sy(val)} x2={width - padR + 6} y2={y} stroke={meta.color} strokeOpacity={0.45} strokeWidth={1} />
              <text x={width - padR + 8} y={y} fontSize="10" fill={meta.color} dominantBaseline="middle">
                {isZh ? meta.labelZh : meta.labelEn}
              </text>
            </g>
          );
        })}

        {/* Key event markers */}
        {points.filter((p) => p.eventType).map((p) => {
          const y = view.sy(p.currentPath);
          const x = view.sx(p.age);
          const color = p.eventType === "risk" ? "#f87171" : p.eventType === "low" ? "#facc15" : p.eventType === "crossing" ? "#c4b5fd" : p.eventType === "branch" ? "#22d3ee" : "#fde68a";
          const symbol =
            p.eventType === "peak" ? <polygon points={`${x},${y - 5} ${x - 4},${y + 3} ${x + 4},${y + 3}`} fill={color} /> :
            p.eventType === "low"  ? <circle cx={x} cy={y} r={3.5} fill="transparent" stroke={color} strokeWidth={1.4} /> :
            p.eventType === "risk" ? <polygon points={`${x},${y - 5} ${x + 4.5},${y + 3.5} ${x - 4.5},${y + 3.5}`} fill="none" stroke={color} strokeWidth={1.4} /> :
            p.eventType === "branch" ? <path d={`M${x - 4},${y + 4} L${x},${y - 3} L${x + 4},${y + 4}`} fill="none" stroke={color} strokeWidth={1.4} /> :
            <path d={`M${x - 4},${y} L${x + 4},${y} M${x},${y - 4} L${x},${y + 4}`} stroke={color} strokeWidth={1.2} />;
          return (
            <g key={`ev-${p.age}`} data-testid={`math-event-${p.age}`}>
              {symbol}
            </g>
          );
        })}

        {/* Cursor + tooltip vertical */}
        {focusX != null && (
          <line x1={focusX} x2={focusX} y1={padT} y2={height - padB} stroke="rgba(252,211,77,0.55)" strokeDasharray="2 3" />
        )}
      </svg>

      {/* Tooltip / info card */}
      {activePoint && (
        <ToolTipCard point={activePoint} hasExperiment={hasExperiment} lang={lang} locked={lockedAge != null} onClear={() => setLockedAge(null)} />
      )}

      {!activePoint && (
        <p className="mt-2 text-[10px] text-amber-200/40">
          {isZh
            ? "把鼠标或手指移到曲线上, 查看那一年的数值与前 3 个主要影响维度; 点击/长按锁定。"
            : "Hover / drag on the curve to read values and the top 3 dimensions for that year; tap to lock."}
        </p>
      )}
    </div>
  );
}

function ToolTipCard({
  point,
  hasExperiment,
  lang,
  locked,
  onClear,
}: {
  point: LifeMathPoint;
  hasExperiment: boolean;
  lang: "zh" | "en";
  locked: boolean;
  onClear: () => void;
}) {
  const isZh = lang === "zh";
  const phase = phaseForAge(point.age);
  const topDims = [...LIFE_DIMENSIONS]
    .map((d) => ({ d, delta: point.dimensions[d] - 50 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const diffBase = point.currentPath - point.baseline;
  return (
    <div data-testid="math-tooltip" className="mt-2 rounded-lg border border-amber-400/20 bg-[#0f0f1a]/90 p-3 text-[12px] text-amber-50">
      <div className="flex items-center justify-between gap-2">
        <span className="font-serif text-sm">
          {point.age} {isZh ? `岁 · ${phase.label.zh}` : `· ${phase.label.en}`}
        </span>
        {locked && (
          <button type="button" onClick={onClear} className="rounded border border-amber-400/30 px-2 py-0.5 text-[10px] text-amber-100/80">
            {isZh ? "解除锁定" : "Unlock"}
          </button>
        )}
      </div>
      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
        <span>{isZh ? "现实路径" : "Current"}: <span className="font-mono text-amber-200">{point.currentPath.toFixed(0)}</span></span>
        <span>{isZh ? "生命基线" : "Baseline"}: <span className="font-mono text-amber-200">{point.baseline.toFixed(0)}</span></span>
        {hasExperiment && (
          <span>{isZh ? "实验分支" : "Experiment"}: <span className="font-mono text-cyan-200">{point.experimentPath?.toFixed(0)}</span></span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-amber-200/80">
        {isZh
          ? `与基线 ${diffBase >= 0 ? "高于" : "低于"} ${Math.abs(diffBase).toFixed(0)} 分`
          : `${diffBase >= 0 ? "Above" : "Below"} baseline by ${Math.abs(diffBase).toFixed(0)}`}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {topDims.map(({ d, delta }) => (
          <span key={d} className="rounded-full border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: `${DIMENSION_COLORS[d]}55`, color: DIMENSION_COLORS[d] }}>
            {isZh ? DIMENSION_LABELS[d].zh : DIMENSION_LABELS[d].en} {delta > 0 ? "+" : ""}{delta.toFixed(0)}
          </span>
        ))}
      </div>
      {point.shortHint && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-100/85">
          {isZh ? point.shortHint.zh : point.shortHint.en}
        </p>
      )}
    </div>
  );
}
