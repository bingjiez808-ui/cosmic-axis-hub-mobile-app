import { useMemo } from "react";

import {
  DOMAIN_COLORS,
  DOMAIN_DASH,
  DOMAIN_KEYS,
  DOMAIN_LABELS,
  type DomainKey,
} from "./domains";
import type { BuildDomainResult, ScenarioBranch, TurningPoint } from "./LifeDomainModel";

/**
 * Seven-line composite chart. Composite ribbon always visible; per-domain
 * lines only when toggled on. Branch overlays draw from the focus age
 * forward — dashed lines on the composite AND, when a domain is visible,
 * on each domain the branch actually modifies. Legend + status bar surface
 * which branches are on the chart.
 */
export function LifeLinesChart({
  result,
  visibleDomains,
  focusAge,
  onFocusAge,
  branches = [],
  ariaLabel,
  lang,
  highlight = false,
}: {
  result: BuildDomainResult;
  visibleDomains: Set<DomainKey>;
  focusAge: number;
  onFocusAge?: (age: number) => void;
  branches?: Array<{ branch: ScenarioBranch; color: string }>;
  ariaLabel: string;
  lang: "zh" | "en";
  highlight?: boolean;
}) {
  const width = 760;
  const height = 300;
  const padL = 40;
  const padR = 60; // extra room for end labels
  const padT = 20;
  const padB = 30;
  const isZh = lang === "zh";
  const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

  const view = useMemo(() => {
    if (result.ages.length === 0) return null;
    const ages = result.ages;
    const minAge = ages[0];
    const maxAge = ages[ages.length - 1];
    const spanAge = Math.max(1, maxAge - minAge);
    const sx = (a: number) => padL + ((a - minAge) / spanAge) * (width - padL - padR);
    const sy = (v: number) => padT + (1 - v / 100) * (height - padT - padB);
    const line = (values: number[]) =>
      ages
        .map((a, i) => `${i === 0 ? "M" : "L"}${sx(a).toFixed(1)},${sy(values[i]).toFixed(1)}`)
        .join(" ");
    const compositePath = line(result.compositeSeries);
    const domainPaths: Record<DomainKey, string> = {} as Record<DomainKey, string>;
    for (const k of DOMAIN_KEYS) domainPaths[k] = line(result.domainSeries[k]);

    const idx = Math.max(0, ages.indexOf(focusAge));
    const startAge = ages[idx];
    const startComposite = result.compositeSeries[idx];

    const branchOverlays = branches.map(({ branch, color }) => {
      // Composite branch path.
      let running = startComposite;
      const cPts: string[] = [`M${sx(startAge).toFixed(1)},${sy(running).toFixed(1)}`];
      let baseline = startComposite;
      let ended = startAge;
      for (let y = 0; y < branch.perYearDeltas.length; y += 1) {
        const targetAge = ages[idx + 1 + y];
        if (targetAge == null) break;
        const total = Object.values(branch.perYearDeltas[y]).reduce((a, b) => a + (b ?? 0), 0);
        running = clamp01(result.compositeSeries[idx + 1 + y] + total * 0.6);
        baseline = result.compositeSeries[idx + 1 + y];
        cPts.push(`L${sx(targetAge).toFixed(1)},${sy(running).toFixed(1)}`);
        ended = targetAge;
      }
      const diff = running - baseline;

      // Per-domain branch paths (only for domains actually affected).
      const perDomainPaths: Partial<Record<DomainKey, string>> = {};
      const perDomainHasEffect: Partial<Record<DomainKey, boolean>> = {};
      for (const k of DOMAIN_KEYS) {
        const pts: string[] = [];
        let v = result.domainSeries[k][idx];
        pts.push(`M${sx(startAge).toFixed(1)},${sy(v).toFixed(1)}`);
        let hasEffect = false;
        for (let y = 0; y < branch.perYearDeltas.length; y += 1) {
          const ta = ages[idx + 1 + y];
          if (ta == null) break;
          const d = branch.perYearDeltas[y][k] ?? 0;
          if (Math.abs(d) > 0.05) hasEffect = true;
          v = clamp01(result.domainSeries[k][idx + 1 + y] + d);
          pts.push(`L${sx(ta).toFixed(1)},${sy(v).toFixed(1)}`);
        }
        perDomainPaths[k] = pts.join(" ");
        perDomainHasEffect[k] = hasEffect;
      }

      return {
        color,
        label: branch.label[lang],
        compositePath: cPts.join(" "),
        endX: sx(ended),
        endY: sy(running),
        diff,
        perDomainPaths,
        perDomainHasEffect,
      };
    });

    return {
      ages, minAge, maxAge, sx, sy,
      compositePath, domainPaths,
      startAge, startX: sx(startAge),
      branchOverlays,
    };
  }, [result, focusAge, branches, lang]);

  if (!view) {
    return (
      <div className="rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 p-6 text-center text-xs text-amber-200/70">
        {lang === "zh" ? "无数据" : "No data"}
      </div>
    );
  }

  const yTicks = [0, 25, 50, 75, 100];
  const ageTicks = [
    view.minAge,
    Math.round(view.minAge + (view.maxAge - view.minAge) / 4),
    Math.round((view.minAge + view.maxAge) / 2),
    Math.round(view.minAge + ((view.maxAge - view.minAge) * 3) / 4),
    view.maxAge,
  ];
  const focusX = view.sx(focusAge);

  // "No direct modification" note when a single domain is visible and none
  // of the active branches modify it.
  let noEffectNote: string | null = null;
  if (branches.length > 0 && visibleDomains.size === 1) {
    const only = [...visibleDomains][0];
    const anyEffect = view.branchOverlays.some((b) => b.perDomainHasEffect[only]);
    if (!anyEffect) {
      noEffectNote = isZh
        ? `此方案对「${DOMAIN_LABELS[only].zh}」无直接修正。`
        : `These branches make no direct modification to "${DOMAIN_LABELS[only].en}".`;
    }
  }

  return (
    <div
      data-testid="life-lines-chart-wrap"
      className={`w-full overflow-x-auto rounded-xl border bg-[#0b0b14]/70 transition ${
        highlight
          ? "border-cyan-300/70 shadow-[0_0_0_2px_rgba(103,232,249,0.35)] motion-safe:animate-pulse"
          : "border-amber-400/15"
      }`}
    >
      {branches.length > 0 && (
        <div
          data-testid="life-branch-status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-[11px] text-cyan-100"
        >
          <span>
            {isZh
              ? `正在比较 ${branches.length} 条人生分支 · 从 ${view.startAge} 岁开始 · 未来 ${branches[0]?.branch.perYearDeltas.length ?? 5} 年`
              : `Comparing ${branches.length} life branch${branches.length === 1 ? "" : "es"} · starting age ${view.startAge} · next ${branches[0]?.branch.perYearDeltas.length ?? 5} years`}
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block h-[2px] w-4" style={{ background: "#fde68a" }} />
              {isZh ? "当前轨迹" : "Current path"}
            </span>
            {view.branchOverlays.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-[2px] w-4"
                  style={{ background: b.color, borderTop: `2px dashed ${b.color}` }}
                />
                {b.label}
                <span className="text-cyan-200/70">
                  {b.diff > 0 ? "+" : ""}{b.diff.toFixed(1)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[420px] cursor-crosshair"
        onClick={(e) => {
          if (!onFocusAge) return;
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const pxPerUnit = rect.width / width;
          const localX = (e.clientX - rect.left) / pxPerUnit;
          const span = Math.max(1, view.maxAge - view.minAge);
          const a = Math.round(view.minAge + ((localX - padL) / (width - padL - padR)) * span);
          onFocusAge(Math.max(view.minAge, Math.min(view.maxAge, a)));
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={view.sy(t)} y2={view.sy(t)} stroke="rgba(252,211,77,0.08)" />
            <text x={padL - 6} y={view.sy(t)} fill="rgba(252,211,77,0.5)" fontSize={9} textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={view.sy(50)} y2={view.sy(50)} stroke="rgba(252,211,77,0.2)" strokeDasharray="2 4" />
        {ageTicks.map((a) => (
          <text key={a} x={view.sx(a)} y={height - 10} fill="rgba(252,211,77,0.55)" fontSize={10} textAnchor="middle">{a}</text>
        ))}

        {/* Composite ribbon (always visible) */}
        <path d={view.compositePath} fill="none" stroke="#fde68a" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />

        {/* Per-domain lines when toggled */}
        {DOMAIN_KEYS.map((k) =>
          visibleDomains.has(k) ? (
            <path key={k} d={view.domainPaths[k]} fill="none" stroke={DOMAIN_COLORS[k]} strokeOpacity={0.85} strokeWidth={1.6} strokeDasharray={DOMAIN_DASH[k]} strokeLinejoin="round" strokeLinecap="round" />
          ) : null,
        )}

        {/* Branch overlays: composite + per-visible-domain if affected */}
        {view.branchOverlays.map((b, i) => (
          <g key={`branch-${i}`}>
            <path
              d={b.compositePath}
              fill="none"
              stroke={b.color}
              strokeWidth={2.2}
              strokeDasharray="4 4"
              strokeLinecap="round"
              opacity={0.9}
              data-testid={`branch-composite-${i}`}
            />
            {DOMAIN_KEYS.map((k) => {
              if (!visibleDomains.has(k)) return null;
              if (!b.perDomainHasEffect[k]) return null;
              return (
                <path
                  key={`branch-${i}-${k}`}
                  d={b.perDomainPaths[k]}
                  fill="none"
                  stroke={b.color}
                  strokeOpacity={0.75}
                  strokeWidth={1.4}
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                  data-testid={`branch-domain-${i}-${k}`}
                />
              );
            })}
            <text
              x={b.endX + 4}
              y={b.endY}
              fill={b.color}
              fontSize={9}
              dominantBaseline="middle"
            >
              {b.label} {b.diff > 0 ? "+" : ""}{b.diff.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Start-of-branch marker */}
        {branches.length > 0 && (
          <line
            x1={view.startX} x2={view.startX} y1={padT} y2={height - padB}
            stroke="rgba(103,232,249,0.5)" strokeDasharray="3 3" strokeWidth={1}
          />
        )}

        {/* Turning points */}
        {result.turningPoints.map((tp: TurningPoint) => (
          <g key={`${tp.age}-${tp.evidenceRef}`}>
            <circle cx={view.sx(tp.age)} cy={view.sy(50)} r={3.5} fill="#fcd34d" stroke="#0b0b14" strokeWidth={1} />
            <text x={view.sx(tp.age)} y={padT - 4} fontSize={9} textAnchor="middle" fill="rgba(252,211,77,0.7)">
              {tp.age}
            </text>
          </g>
        ))}

        {/* Focus cursor */}
        <line x1={focusX} x2={focusX} y1={padT} y2={height - padB} stroke="rgba(252,211,77,0.5)" strokeDasharray="2 3" />
      </svg>
      {noEffectNote && (
        <div className="border-t border-amber-400/10 px-3 py-2 text-[11px] text-amber-200/70">
          {noEffectNote}
        </div>
      )}
    </div>
  );
}

/**
 * Radar / flower cross-section for one age. Seven petals, one per domain.
 */
export function AgeCrossSection({
  scores,
  ariaLabel,
  lang,
}: {
  scores: Record<DomainKey, number>;
  ariaLabel: string;
  lang: "zh" | "en";
}) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 28;
  const n = DOMAIN_KEYS.length;

  const points = DOMAIN_KEYS.map((k, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = (scores[k] / 100) * rMax;
    return {
      k,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      labelX: cx + Math.cos(angle) * (rMax + 14),
      labelY: cy + Math.sin(angle) * (rMax + 14),
    };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${size} ${size}`} className="block w-full max-w-[260px]">
      {[25, 50, 75, 100].map((r) => (
        <circle key={r} cx={cx} cy={cy} r={(r / 100) * rMax} fill="none" stroke="rgba(252,211,77,0.10)" />
      ))}
      {DOMAIN_KEYS.map((_, i) => {
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * rMax}
            y2={cy + Math.sin(angle) * rMax}
            stroke="rgba(252,211,77,0.08)"
          />
        );
      })}
      <path d={path} fill="rgba(253,230,138,0.18)" stroke="#fde68a" strokeWidth={1.5} />
      {points.map((p) => (
        <g key={p.k}>
          <circle cx={p.x} cy={p.y} r={3} fill={DOMAIN_COLORS[p.k]} />
          <text
            x={p.labelX}
            y={p.labelY}
            fontSize={9}
            fill="rgba(252,211,77,0.75)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {DOMAIN_LABELS[p.k][lang]} {Math.round(scores[p.k])}
          </text>
        </g>
      ))}
    </svg>
  );
}
