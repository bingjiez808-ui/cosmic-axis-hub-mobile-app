import { useMemo } from "react";

import {
  DIMENSION_COLORS,
  DIMENSION_LABELS,
  LIFE_DIMENSIONS,
  phaseForAge,
  type LifeDimensionKey,
  type LifeMathPoint,
} from "./types";

/**
 * 年度生活横截面雷达图。
 *
 * 值全部来自主图同一份 `LifeMathPoint`, 因此保证与折线图同源。
 * 点击某个维度轴会通过 `onAxisClick` 回传给上层, 由 MathRoomV2 联动主图高亮。
 */
export function YearlyRadar({
  point,
  onSelectAge,
  onAxisClick,
  onBackToChart,
  minAge,
  maxAge,
  lang,
}: {
  point: LifeMathPoint | null;
  onSelectAge: (age: number) => void;
  onAxisClick: (dim: LifeDimensionKey) => void;
  onBackToChart: () => void;
  minAge: number;
  maxAge: number;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;

  const derived = useMemo(() => {
    if (!point) return null;
    const dims = LIFE_DIMENSIONS.map((d) => ({
      d,
      v: point.dimensions[d],
      base: point.dimensionBaselines[d],
      delta: point.dimensions[d] - point.dimensionBaselines[d],
    }));
    const invest = [...dims].sort((a, b) => b.delta - a.delta)[0];
    const friction = [...dims].sort((a, b) => a.delta - b.delta)[0];
    return { dims, invest, friction };
  }, [point]);

  if (!point || !derived) {
    return (
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 text-center text-[12px] text-amber-200/70">
        {isZh ? "先在主图上选择一个年龄。" : "Pick an age on the chart above."}
      </section>
    );
  }

  const axisAngle = (i: number) => (-Math.PI / 2) + (i / LIFE_DIMENSIONS.length) * Math.PI * 2;
  const point2 = (i: number, radius: number) => ({
    x: cx + Math.cos(axisAngle(i)) * radius,
    y: cy + Math.sin(axisAngle(i)) * radius,
  });

  const polygonPoints = LIFE_DIMENSIONS.map((d, i) => {
    const p = point2(i, (point.dimensions[d] / 100) * r);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

  const baselinePoints = LIFE_DIMENSIONS.map((d, i) => {
    const p = point2(i, (point.dimensionBaselines[d] / 100) * r);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

  const phase = phaseForAge(point.age);
  const canPrev = point.age > minAge;
  const canNext = point.age < maxAge;

  return (
    <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4 md:p-5" data-testid="yearly-radar">
      <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
        {isZh ? "生活横截面" : "Life cross-section"}
      </div>
      <h3 className="mt-1 font-serif text-lg text-amber-50">
        {isZh ? "这一年的生活横截面" : "This year, in cross-section"}
      </h3>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-amber-100/80">
        {isZh
          ? "折线图告诉你变化发生在哪里; 这张雷达图把选中年龄停下来, 看看七个领域如何共同构成这一年的状态。"
          : "The line chart shows where change happens; this radar pauses on the chosen age to show how the seven domains together shape that year."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
        {/* Radar */}
        <div className="mx-auto">
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
            aria-label={isZh ? `${point.age} 岁生活横截面` : `Cross-section at age ${point.age}`}>
            {/* rings */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <polygon key={f}
                points={LIFE_DIMENSIONS.map((_, i) => { const p = point2(i, r * f); return `${p.x},${p.y}`; }).join(" ")}
                fill="none" stroke="rgba(252,211,77,0.10)" strokeWidth={1} />
            ))}
            {/* axes + labels */}
            {LIFE_DIMENSIONS.map((d, i) => {
              const end = point2(i, r);
              const lab = point2(i, r + 14);
              return (
                <g key={d}>
                  <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(252,211,77,0.15)" />
                  <text x={lab.x} y={lab.y}
                    fontSize="10" fill={DIMENSION_COLORS[d]} textAnchor="middle" dominantBaseline="middle"
                    style={{ cursor: "pointer" }}
                    data-testid={`radar-axis-${d}`}
                    onClick={() => onAxisClick(d)}>
                    {DIMENSION_LABELS[d][lang]}
                  </text>
                </g>
              );
            })}
            {/* baseline polygon (dashed) */}
            <polygon points={baselinePoints} fill="rgba(252,243,199,0.06)" stroke="rgba(252,243,199,0.45)" strokeDasharray="3 3" strokeWidth={1.2} />
            {/* current polygon */}
            <polygon points={polygonPoints} fill="rgba(245,158,11,0.18)" stroke="#f59e0b" strokeWidth={1.6} />
            {/* per-dim dots */}
            {LIFE_DIMENSIONS.map((d, i) => {
              const p = point2(i, (point.dimensions[d] / 100) * r);
              return <circle key={d} cx={p.x} cy={p.y} r={3} fill={DIMENSION_COLORS[d]} />;
            })}
          </svg>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-400/20 bg-[#0f0f1a]/80 p-3 text-[12px] text-amber-100/90">
            <div className="font-serif text-base text-amber-50">
              {point.age} {isZh ? `岁 · ${phase.label.zh}` : `· ${phase.label.en}`}
            </div>
            <div className="mt-1">
              {isZh ? "综合指数" : "Composite"}: <span className="font-mono text-amber-200">{point.currentPath.toFixed(1)}</span>
            </div>
            <div className="mt-1">
              {isZh ? "最值得投入: " : "Best to invest: "}
              <span style={{ color: DIMENSION_COLORS[derived.invest.d] }}>{DIMENSION_LABELS[derived.invest.d][lang]}</span>
              {" "}(+{derived.invest.delta.toFixed(1)})
            </div>
            <div className="mt-1">
              {isZh ? "最需防摩擦: " : "Watch for friction: "}
              <span style={{ color: DIMENSION_COLORS[derived.friction.d] }}>{DIMENSION_LABELS[derived.friction.d][lang]}</span>
              {" "}({derived.friction.delta.toFixed(1)})
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
            {derived.dims.map(({ d, v, base }) => (
              <li key={d} className="flex items-center justify-between rounded border border-white/5 bg-black/25 px-2 py-1">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: DIMENSION_COLORS[d] }} />
                  <span className="text-amber-100/85">{DIMENSION_LABELS[d][lang]}</span>
                </span>
                <span className="font-mono text-amber-200">
                  {v}
                  <span className="ml-1 text-amber-200/40">({Math.round(base)})</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-cyan-300/25 bg-[#0b1428]/70 p-3 text-[11.5px] leading-relaxed text-amber-100/85">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">
              {isZh ? "如何读这一年" : "How to read this year"}
            </div>
            <p className="mt-1">
              {isZh
                ? `这一年并不是单看综合分高低。${DIMENSION_LABELS[derived.invest.d].zh}提供向前的推力, 但${DIMENSION_LABELS[derived.friction.d].zh}偏低, 意味着“能做更多”和“是否承受得住”需要同时考虑。建议先看: ${DIMENSION_LABELS[derived.invest.d].zh}、${DIMENSION_LABELS[derived.friction.d].zh}。`
                : `This year is more than the composite. ${DIMENSION_LABELS[derived.invest.d].en} provides push while ${DIMENSION_LABELS[derived.friction.d].en} runs lower — "do more" and "carry it" need to be weighed together. Start with: ${DIMENSION_LABELS[derived.invest.d].en}, ${DIMENSION_LABELS[derived.friction.d].en}.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onBackToChart}
              className="min-h-8 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 text-[11px] text-amber-50">
              {isZh ? "回到折线图看前后变化" : "Back to the chart"}
            </button>
            <button type="button" disabled={!canPrev} onClick={() => onSelectAge(point.age - 1)}
              className={`min-h-8 rounded-full border px-3 text-[11px] ${canPrev ? "border-amber-400/25 text-amber-100" : "cursor-not-allowed border-white/10 text-white/30"}`}>
              {isZh ? "上一年" : "Previous year"}
            </button>
            <button type="button" disabled={!canNext} onClick={() => onSelectAge(point.age + 1)}
              className={`min-h-8 rounded-full border px-3 text-[11px] ${canNext ? "border-amber-400/25 text-amber-100" : "cursor-not-allowed border-white/10 text-white/30"}`}>
              {isZh ? "下一年" : "Next year"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
