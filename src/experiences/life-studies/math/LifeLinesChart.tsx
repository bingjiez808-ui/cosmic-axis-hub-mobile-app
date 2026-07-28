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
 * Seven-line composite chart. Always draws the composite ribbon; per-domain
 * lines only when toggled on. Turning-point markers only render when the
 * model emitted them (i.e. a period-boundary caused the jump).
 */
export function LifeLinesChart({
  result,
  visibleDomains,
  focusAge,
  onFocusAge,
  branches = [],
  ariaLabel,
  lang,
}: {
  result: BuildDomainResult;
  visibleDomains: Set<DomainKey>;
  focusAge: number;
  onFocusAge?: (age: number) => void;
  branches?: Array<{ branch: ScenarioBranch; color: string }>;
  ariaLabel: string;
  lang: "zh" | "en";
}) {
  const width = 760;
  const height = 300;
  const padL = 40;
  const padR = 16;
  const padT = 20;
  const padB = 30;

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

    // Branch overlays start from focusAge; shift each branch's series against
    // the current composite baseline.
    const branchPaths = branches.map(({ branch, color }) => {
      const idx = Math.max(0, ages.indexOf(focusAge));
      const points: string[] = [];
      let running = result.compositeSeries[idx];
      points.push(`M${sx(ages[idx]).toFixed(1)},${sy(running).toFixed(1)}`);
      for (let y = 0; y < branch.perYearDeltas.length; y += 1) {
        const targetAge = ages[idx + 1 + y];
        if (targetAge == null) break;
        const total = Object.values(branch.perYearDeltas[y]).reduce((a, b) => a + (b ?? 0), 0);
        running = Math.max(0, Math.min(100, result.compositeSeries[idx + 1 + y] + total * 0.6));
        points.push(`L${sx(targetAge).toFixed(1)},${sy(running).toFixed(1)}`);
      }
      return { path: points.join(" "), color, label: branch.label[lang] };
    });

    return { ages, minAge, maxAge, sx, sy, compositePath, domainPaths, branchPaths };
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

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-amber-400/15 bg-[#0b0b14]/70">
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

        {/* Branch overlays */}
        {view.branchPaths.map((b, i) => (
          <path key={i} d={b.path} fill="none" stroke={b.color} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" opacity={0.85} />
        ))}

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
