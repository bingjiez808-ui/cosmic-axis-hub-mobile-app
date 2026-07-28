import { useMemo } from "react";

import {
  BASELINE_COLOR,
  TOTAL_COLOR,
  VARIABLE_COLORS,
  type Composition,
  type FactorKey,
} from "./MathLifeModel";

/**
 * Composite life-function chart. Draws:
 *   - shaded uncertainty band around the total
 *   - dashed baseline (B + cycle only)
 *   - solid total (scenario) curve
 *   - optional highlighted per-factor contribution line (dashed, colored)
 *   - focus-age vertical marker with total node and value label
 *
 * `selectedFactor` dims the total line and lights up that factor's
 * contribution curve so users can see how that single wave shapes the
 * whole. Pure SVG, no charting deps.
 */
export function LifeCompositionChart({
  composition,
  focusAge,
  selectedFactor,
  ariaLabel,
  compact = false,
}: {
  composition: Composition;
  focusAge: number;
  selectedFactor: FactorKey | null;
  ariaLabel: string;
  compact?: boolean;
}) {
  const width = compact ? 520 : 760;
  const height = compact ? 220 : 280;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const view = useMemo(() => {
    if (composition.ages.length === 0) return null;
    const ages = composition.ages;
    const minAge = ages[0];
    const maxAge = ages[ages.length - 1];
    const spanAge = Math.max(1, maxAge - minAge);
    const sx = (a: number) => padL + ((a - minAge) / spanAge) * (width - padL - padR);
    const sy = (v: number) => padT + (1 - v / 100) * (height - padT - padB);
    const syDelta = (v: number) => {
      // For factor contribution overlay, offset around baseline midline.
      const mid = 50;
      const value = mid + v * 2.5; // amplify small deltas for visibility
      return sy(Math.max(0, Math.min(100, value)));
    };
    const line = (values: number[], scaler: (v: number) => number) =>
      ages
        .map((a, i) => `${i === 0 ? "M" : "L"}${sx(a).toFixed(1)},${scaler(values[i]).toFixed(1)}`)
        .join(" ");

    const baselinePath = line(
      ages.map((_, i) => composition.baselineSeries[i] + composition.cycleSeries[i]),
      sy,
    );
    const totalPath = line(composition.totalSeries, sy);
    const bandTop = ages.map((a, i) => `${sx(a).toFixed(1)},${sy(composition.bandHigh[i]).toFixed(1)}`);
    const bandBot = ages
      .slice()
      .reverse()
      .map((a, i) => {
        const ri = ages.length - 1 - i;
        return `${sx(a).toFixed(1)},${sy(composition.bandLow[ri]).toFixed(1)}`;
      });
    const bandPath = `M${bandTop.join(" L")} L${bandBot.join(" L")} Z`;

    const focusIdx = Math.max(0, ages.indexOf(focusAge));
    const focusX = sx(ages[focusIdx]);
    const focusTotal = composition.totalSeries[focusIdx];

    let factorPath: string | null = null;
    if (selectedFactor) {
      factorPath = line(composition.factorSeries[selectedFactor], syDelta);
    }

    return {
      minAge, maxAge, sx, sy, baselinePath, totalPath, bandPath,
      focusIdx, focusX, focusTotal, factorPath,
    };
  }, [composition, focusAge, selectedFactor, width, height]);

  if (!view) {
    return (
      <div className="rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 p-6 text-center text-xs text-amber-200/70">
        No data
      </div>
    );
  }

  const yTicks = [0, 25, 50, 75, 100];
  const ageTicks = [view.minAge, Math.round((view.minAge + view.maxAge) / 2), view.maxAge];
  const totalOpacity = selectedFactor ? 0.35 : 1;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-amber-400/15 bg-[#0b0b14]/70">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[420px]"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={view.sy(t)} y2={view.sy(t)}
              stroke="rgba(252,211,77,0.08)" strokeWidth={1} />
            <text x={padL - 6} y={view.sy(t)} fill="rgba(252,211,77,0.5)"
              fontSize={9} textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {ageTicks.map((a) => (
          <text key={a} x={view.sx(a)} y={height - 8}
            fill="rgba(252,211,77,0.55)" fontSize={10} textAnchor="middle">{a}</text>
        ))}

        <path d={view.bandPath} fill="rgba(252,211,77,0.10)" stroke="none" />
        <path d={view.baselinePath} fill="none"
          stroke={BASELINE_COLOR} strokeOpacity={0.7}
          strokeWidth={1.2} strokeDasharray="4 4" />
        <path d={view.totalPath} fill="none"
          stroke={TOTAL_COLOR} strokeOpacity={totalOpacity}
          strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

        {view.factorPath && selectedFactor && (
          <path
            d={view.factorPath}
            fill="none"
            stroke={VARIABLE_COLORS[selectedFactor]}
            strokeWidth={2}
            strokeDasharray="6 3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <line x1={view.focusX} x2={view.focusX} y1={padT} y2={height - padB}
          stroke="rgba(252,211,77,0.45)" strokeDasharray="2 3" />
        <circle cx={view.focusX} cy={view.sy(view.focusTotal)}
          r={5} fill={TOTAL_COLOR} stroke="#0b0b14" strokeWidth={1.5} />
        <text x={view.focusX + 8} y={view.sy(view.focusTotal) - 8}
          fontSize={11} fill={TOTAL_COLOR}
          style={{ fontVariantNumeric: "tabular-nums" }}>
          age {focusAge} · {view.focusTotal.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

/**
 * Mini per-factor wave — used inside FactorWaveControl so users can
 * see how their slider reshapes a single factor's contribution over life.
 * A thin baseline (0 delta) is drawn for reference.
 */
export function FactorWave({
  values,
  color,
  active,
  ariaLabel,
}: {
  values: number[];
  color: string;
  active: boolean;
  ariaLabel: string;
}) {
  const width = 220;
  const height = 44;
  if (values.length === 0) return null;
  const maxAbs = Math.max(4, ...values.map((v) => Math.abs(v)));
  const mid = height / 2;
  const sx = (i: number) => (i / (values.length - 1)) * width;
  const sy = (v: number) => mid - (v / maxAbs) * (mid - 4);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="block h-11 w-full"
    >
      <line x1={0} x2={width} y1={mid} y2={mid} stroke="rgba(252,211,77,0.15)" strokeWidth={1} />
      <path d={path} fill="none" stroke={color}
        strokeOpacity={active ? 1 : 0.65}
        strokeWidth={active ? 2.5 : 1.6}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Horizontal "wide leverage" bars: shows the same sensitivity data as
 * before but reframed as a second-layer signal (if you tweaked just
 * ONE variable, which would move the curve most).
 */
export function LeverageBars({
  sensitivity,
  labels,
  colors,
}: {
  sensitivity: Record<string, number>;
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const entries = Object.entries(sensitivity).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <ul aria-label="Leverage" className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-3 text-xs text-amber-100/80">
          <span className="flex w-24 shrink-0 items-center gap-2 truncate">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colors[k] }} />
            {labels[k]}
          </span>
          <span className="relative h-2 flex-1 rounded-full bg-amber-400/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${(v / max) * 100}%`, background: colors[k], opacity: 0.75 }}
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

/**
 * Zero-axis contribution breakdown at the current focus age.
 * Positive contributions extend to the right; negative to the left.
 * Baseline / cycle sit alongside the four factor waves using the same colors.
 */
export function ContributionBreakdown({
  focus,
  labels,
  colors,
  lang,
}: {
  focus: {
    baseline: number;
    cycle: number;
    factors: Record<FactorKey, number>;
    total: number;
  };
  labels: { baseline: string; cycle: string; factors: Record<FactorKey, string>; total: string };
  colors: Record<FactorKey, string>;
  lang: "zh" | "en";
}) {
  // Baseline is a large positive number; visualize factors around zero instead.
  // We show baseline+cycle as a single anchor bar, then delta bars per factor.
  const anchor = focus.baseline + focus.cycle;
  const items: { key: string; label: string; value: number; color: string; anchor?: boolean }[] = [
    { key: "anchor", label: `${labels.baseline} + ${labels.cycle}`, value: anchor, color: BASELINE_COLOR, anchor: true },
    { key: "action", label: labels.factors.action, value: focus.factors.action, color: colors.action },
    { key: "recovery", label: labels.factors.recovery, value: focus.factors.recovery, color: colors.recovery },
    { key: "learning", label: labels.factors.learning, value: focus.factors.learning, color: colors.learning },
    { key: "boundaries", label: labels.factors.boundaries, value: focus.factors.boundaries, color: colors.boundaries },
  ];
  const maxDelta = Math.max(3, ...items.filter((i) => !i.anchor).map((i) => Math.abs(i.value)));

  return (
    <div className="space-y-2 text-xs">
      {items.map((it) => {
        if (it.anchor) {
          return (
            <div key={it.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-amber-100/85">{it.label}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-md bg-amber-400/5">
                <span
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${Math.min(100, it.value)}%`, background: it.color, opacity: 0.55 }}
                />
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-amber-200/80">
                {it.value.toFixed(1)}
              </span>
            </div>
          );
        }
        const pct = Math.min(1, Math.abs(it.value) / maxDelta) * 50; // half-width per side
        const positive = it.value >= 0;
        return (
          <div key={it.key} className="flex items-center gap-3">
            <span className="flex w-28 shrink-0 items-center gap-2 truncate text-amber-100/85">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: it.color }} />
              {it.label}
            </span>
            <span className="relative h-3 flex-1 rounded-md bg-amber-400/5">
              <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-amber-400/25" />
              <span
                className="absolute inset-y-0 rounded-md"
                style={{
                  left: positive ? "50%" : `${50 - pct}%`,
                  width: `${pct}%`,
                  background: it.color,
                  opacity: 0.85,
                }}
              />
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-amber-200/80">
              {it.value > 0 ? "+" : ""}
              {it.value.toFixed(1)}
            </span>
          </div>
        );
      })}
      <div className="mt-3 flex items-center gap-3 border-t border-amber-400/15 pt-3">
        <span className="w-28 shrink-0 truncate text-amber-100 font-semibold">{labels.total}</span>
        <span className="flex-1 text-[11px] text-amber-200/60">
          {lang === "zh" ? "所有分量之和（已截断到 0–100）" : "Sum of all components (clamped 0–100)"}
        </span>
        <span className="w-14 shrink-0 text-right font-mono text-amber-100">
          {focus.total.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
