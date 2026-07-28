import { useMemo } from "react";

import type { LifePoint } from "./MathLifeModel";

/**
 * Minimal SVG line chart with baseline + scenario + shaded uncertainty
 * band. Purely presentational and dependency-free (no recharts).
 *
 * The band is drawn from `bandLow` to `bandHigh` as a translucent
 * polygon; the two lines are baseline (dashed) and scenario (solid).
 * A vertical focus line marks the current age selection.
 */
export function LifeFunctionChart({
  series,
  focusAge,
  ariaLabel,
}: {
  series: LifePoint[];
  focusAge: number;
  ariaLabel: string;
}) {
  const width = 720;
  const height = 260;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 28;

  const view = useMemo(() => {
    if (series.length === 0) return null;
    const minAge = series[0].age;
    const maxAge = series[series.length - 1].age;
    const spanAge = Math.max(1, maxAge - minAge);
    const sx = (a: number) => padL + ((a - minAge) / spanAge) * (width - padL - padR);
    const sy = (v: number) => padT + (1 - v / 100) * (height - padT - padB);
    const baselinePath = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.age).toFixed(1)},${sy(p.baseline).toFixed(1)}`)
      .join(" ");
    const scenarioPath = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.age).toFixed(1)},${sy(p.scenario).toFixed(1)}`)
      .join(" ");
    const bandTop = series.map((p) => `${sx(p.age).toFixed(1)},${sy(p.bandHigh).toFixed(1)}`);
    const bandBot = series
      .slice()
      .reverse()
      .map((p) => `${sx(p.age).toFixed(1)},${sy(p.bandLow).toFixed(1)}`);
    const bandPath = `M${bandTop.join(" L")} L${bandBot.join(" L")} Z`;
    const focus = series.find((p) => p.age === focusAge) ?? series[0];
    return {
      minAge,
      maxAge,
      sx,
      sy,
      baselinePath,
      scenarioPath,
      bandPath,
      focus,
    };
  }, [series, focusAge]);

  if (!view) {
    return (
      <div className="rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 p-6 text-center text-xs text-amber-200/70">
        No data
      </div>
    );
  }

  // Y ticks every 25.
  const yTicks = [0, 25, 50, 75, 100];
  const ageTicks = [view.minAge, Math.round((view.minAge + view.maxAge) / 2), view.maxAge];

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-amber-400/15 bg-[#0b0b14]/70">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[520px]"
      >
        {/* grid */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={width - padR}
              y1={view.sy(t)}
              y2={view.sy(t)}
              stroke="rgba(252,211,77,0.08)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={view.sy(t)}
              fill="rgba(252,211,77,0.5)"
              fontSize={9}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {t}
            </text>
          </g>
        ))}
        {ageTicks.map((a) => (
          <text
            key={a}
            x={view.sx(a)}
            y={height - 8}
            fill="rgba(252,211,77,0.55)"
            fontSize={10}
            textAnchor="middle"
          >
            {a}
          </text>
        ))}

        {/* uncertainty band */}
        <path d={view.bandPath} fill="rgba(252,211,77,0.10)" stroke="none" />

        {/* baseline (dashed) */}
        <path
          d={view.baselinePath}
          fill="none"
          stroke="rgba(226,192,120,0.7)"
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />

        {/* scenario (solid) */}
        <path
          d={view.scenarioPath}
          fill="none"
          stroke="rgb(252,211,77)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* focus */}
        <line
          x1={view.sx(view.focus.age)}
          x2={view.sx(view.focus.age)}
          y1={padT}
          y2={height - padB}
          stroke="rgba(252,211,77,0.4)"
          strokeDasharray="2 3"
        />
        <circle
          cx={view.sx(view.focus.age)}
          cy={view.sy(view.focus.scenario)}
          r={4.5}
          fill="rgb(252,211,77)"
        />

        {/* legend */}
        <g transform={`translate(${padL},${padT + 4})`}>
          <g transform="translate(0,0)">
            <line x1={0} x2={16} y1={0} y2={0} stroke="rgba(226,192,120,0.7)" strokeWidth={1.2} strokeDasharray="4 4" />
            <text x={20} y={3} fontSize={10} fill="rgba(252,211,77,0.7)">baseline</text>
          </g>
          <g transform="translate(90,0)">
            <line x1={0} x2={16} y1={0} y2={0} stroke="rgb(252,211,77)" strokeWidth={2} />
            <text x={20} y={3} fontSize={10} fill="rgba(252,211,77,0.9)">scenario</text>
          </g>
          <g transform="translate(190,0)">
            <rect x={0} y={-4} width={16} height={8} fill="rgba(252,211,77,0.15)" />
            <text x={20} y={3} fontSize={10} fill="rgba(252,211,77,0.7)">uncertainty</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Horizontal sensitivity bars — how much each variable would move the
 * scenario line at the focus age. Larger = higher leverage right now.
 */
export function SensitivityBars({
  sensitivity,
  labels,
}: {
  sensitivity: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(sensitivity).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <ul aria-label="Sensitivity" className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-3 text-xs text-amber-100/80">
          <span className="w-24 shrink-0 truncate">{labels[k]}</span>
          <span className="relative h-2 flex-1 rounded-full bg-amber-400/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-amber-300/80"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-[11px] text-amber-200/70">
            {v.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
