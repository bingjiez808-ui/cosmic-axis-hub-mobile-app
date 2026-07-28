/**
 * Math-room model — Y(t) = B + C(t) + Σ wi·Xi + ε
 *
 * Pure, deterministic and dependency-free. The math room's chart,
 * sliders, sensitivity map and rule-based curator summary all read
 * from this module. No AI, no Math.random, no wall clock.
 *
 * Notes:
 *   • ε is not applied to Y. It only widens the uncertainty band
 *     drawn around Y. Toggling / scaling noise MUST NOT change facts
 *     — see `MathLifeModel.test.ts` for the invariant.
 *   • The four variables (action / recovery / learning / boundaries)
 *     are self-reported scenario inputs, not derived from the chart.
 *     They stay identical between demo and personalized modes; only
 *     the seed (baseline B and cycle phases C) changes.
 *
 * IMPORTANT: this is an interpretive / self-reflection model, NOT a
 * statistically validated predictor. Do not present outputs as
 * probabilities, forecasts or scientific claims.
 */

export type VariableKey = "action" | "recovery" | "learning" | "boundaries";

export type MathScenario = {
  /** Each variable in [0, 100], nominal = 50. */
  variables: Record<VariableKey, number>;
  /** Uncertainty band width in [0, 1]. Nominal = 0.35. */
  noise: number;
};

export const DEFAULT_SCENARIO: MathScenario = {
  variables: { action: 50, recovery: 50, learning: 50, boundaries: 50 },
  noise: 0.35,
};

/** Sensitivity weights wi. Tuned so no single slider dominates. */
export const VARIABLE_WEIGHTS: Record<VariableKey, number> = {
  action: 0.42,
  recovery: 0.28,
  learning: 0.22,
  boundaries: 0.18,
};

export const VARIABLE_LABELS: Record<VariableKey, { zh: string; en: string }> = {
  action: { zh: "行动投入", en: "Action" },
  recovery: { zh: "恢复质量", en: "Recovery" },
  learning: { zh: "学习积累", en: "Learning" },
  boundaries: { zh: "关系边界", en: "Boundaries" },
};

/* ------------------------------------------------------------------ */
/* Deterministic seed — FNV-1a over the seed string.                   */
/* ------------------------------------------------------------------ */

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function seedFromString(seed: string): { baseline: number; phase1: number; phase2: number } {
  const h = fnv1a(seed || "demo");
  const baseline = 45 + ((h & 0x3f) / 0x3f) * 20; // 45..65
  const phase1 = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const phase2 = (((h >>> 16) & 0xffff) / 0xffff) * Math.PI * 2;
  return { baseline, phase1, phase2 };
}

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export type LifePoint = {
  age: number;
  baseline: number;
  scenario: number;
  bandLow: number;
  bandHigh: number;
  cycle: number;
  choiceDelta: number;
};

export type BuildInput = {
  seed: string;
  fromAge: number;
  toAge: number;
  scenario: MathScenario;
};

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function cycleAt(age: number, phase1: number, phase2: number): number {
  const c1 = Math.sin((age / 12) * Math.PI * 2 + phase1);
  const c2 = Math.sin((age / 9) * Math.PI * 2 + phase2);
  // ~[-1.15, 1.15] → scale to ±12 around baseline
  return (c1 * 0.55 + c2 * 0.45) * 12;
}

function choiceDelta(vars: Record<VariableKey, number>): number {
  let d = 0;
  for (const k of Object.keys(VARIABLE_WEIGHTS) as VariableKey[]) {
    const centered = (vars[k] - 50) / 50; // -1..1
    d += centered * VARIABLE_WEIGHTS[k] * 18; // each ≤ ~7.5
  }
  return d;
}

/**
 * Build a series of Y(t) points. Pure function of its arguments.
 *
 * `baseline` is B; `scenario` is B + C(t) + Σ wi·Xi; the band is the
 * scenario line ± (noise * 12) clamped into [0, 100]. Points are
 * generated at 1-year granularity.
 */
export function buildLifeSeries(input: BuildInput): LifePoint[] {
  const { seed, fromAge, toAge, scenario } = input;
  if (!Number.isFinite(fromAge) || !Number.isFinite(toAge) || toAge < fromAge) return [];
  const { baseline, phase1, phase2 } = seedFromString(seed);
  const delta = choiceDelta(scenario.variables);
  const bandHalf = clamp(scenario.noise, 0, 1) * 12;
  const out: LifePoint[] = [];
  for (let a = Math.floor(fromAge); a <= Math.ceil(toAge); a += 1) {
    const c = cycleAt(a, phase1, phase2);
    const base = clamp(baseline + c);
    const scen = clamp(baseline + c + delta);
    out.push({
      age: a,
      baseline: Number(base.toFixed(2)),
      scenario: Number(scen.toFixed(2)),
      bandLow: Number(clamp(scen - bandHalf).toFixed(2)),
      bandHigh: Number(clamp(scen + bandHalf).toFixed(2)),
      cycle: Number(c.toFixed(2)),
      choiceDelta: Number(delta.toFixed(2)),
    });
  }
  return out;
}

/**
 * Per-variable sensitivity: how much Y at the focus age moves when
 * that variable alone shifts by +25 points from its current value.
 * Rule-based, deterministic. Returns absolute deltas suitable for a
 * bar/radar chart.
 */
export function sensitivityAt(
  focusAge: number,
  seed: string,
  scenario: MathScenario,
): Record<VariableKey, number> {
  const out = {} as Record<VariableKey, number>;
  const base = buildLifeSeries({
    seed,
    fromAge: focusAge,
    toAge: focusAge,
    scenario,
  })[0]?.scenario ?? 0;
  for (const k of Object.keys(VARIABLE_WEIGHTS) as VariableKey[]) {
    const bumped: MathScenario = {
      ...scenario,
      variables: {
        ...scenario.variables,
        [k]: clamp(scenario.variables[k] + 25),
      },
    };
    const y = buildLifeSeries({
      seed,
      fromAge: focusAge,
      toAge: focusAge,
      scenario: bumped,
    })[0]?.scenario ?? 0;
    out[k] = Number(Math.abs(y - base).toFixed(2));
  }
  return out;
}

/**
 * Rule-generated "curator note" — never AI. Purely a template
 * composition of the current focus age's scenario delta, the leading
 * sensitivity variable and a clear caveat.
 */
export function curatorSummary(
  focusAge: number,
  series: LifePoint[],
  sensitivity: Record<VariableKey, number>,
  lang: "zh" | "en",
): string {
  const point = series.find((p) => p.age === focusAge) ?? series[0];
  if (!point) return lang === "zh" ? "尚无数据可解释。" : "No data to interpret yet.";
  const leader = (Object.keys(sensitivity) as VariableKey[]).sort(
    (a, b) => sensitivity[b] - sensitivity[a],
  )[0];
  const leaderLabel = VARIABLE_LABELS[leader][lang];
  const trendZh =
    point.choiceDelta > 1
      ? "整体在上抬"
      : point.choiceDelta < -1
        ? "整体在被压低"
        : "接近基线";
  const trendEn =
    point.choiceDelta > 1
      ? "trending up"
      : point.choiceDelta < -1
        ? "being pulled down"
        : "close to baseline";
  if (lang === "zh") {
    return `在 ${focusAge} 岁这一年，你的“如果这样选择”曲线相对基线${trendZh}。当前最值得先调整的一项是「${leaderLabel}」。这是规则生成的一段解释，不是科学预测，也不能替代专业建议。`;
  }
  return `At age ${focusAge}, your "if I choose this" curve is ${trendEn} versus baseline. The single variable that would move the curve most right now is "${leaderLabel}". This is a rule-generated interpretation, not a scientific prediction and not a substitute for professional advice.`;
}

/** Convenience: seed string builder used by the room. */
export function seedForChart(birthISO: string | null | undefined, fallback = "demo"): string {
  if (!birthISO) return fallback;
  const d = new Date(birthISO);
  if (Number.isNaN(d.getTime())) return fallback;
  return `chart:${birthISO}`;
}
