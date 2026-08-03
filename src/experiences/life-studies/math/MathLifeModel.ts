/**
 * Math-room model — "life as a multi-factor synthesizer"
 *
 * Y(t) = B + C(t) + Σ Fi(t) + ε
 *
 *   B      = seed-derived stable baseline (constant per person)
 *   C(t)   = deterministic stage cycles (two sinusoids, seeded phases)
 *   Fi(t)  = per-factor contribution WAVES with distinct time shapes:
 *              action     — strong short-term lift, mild long-term diminish
 *                            + overload penalty when action is high and
 *                              recovery is low
 *              recovery   — gentle early, grows over time; also reduces
 *                            the width of the uncertainty band
 *              learning   — compounding lift over time with a safety cap
 *              boundaries — protects more during cycle stress, mild in calm
 *   ε      = self-reported noise; only widens the uncertainty band,
 *            never moves the deterministic total.
 *
 * The four factors are SCENARIO inputs, not chart facts. They stay
 * identical between demo and personalized modes; only the seed
 * (B and cycle phases) changes.
 *
 * This is an INTERPRETIVE / self-reflection model, not a statistically
 * validated predictor. Do not present its outputs as probabilities,
 * forecasts, or scientific claims.
 */

export type VariableKey = "action" | "recovery" | "learning" | "boundaries";
export type FactorKey = VariableKey;

export type MathScenario = {
  /** Each variable in [0, 100], nominal = 50 → zero contribution. */
  variables: Record<VariableKey, number>;
  /** Uncertainty band width in [0, 1]. Nominal = 0.35. */
  noise: number;
};

export const DEFAULT_SCENARIO: MathScenario = {
  variables: { action: 50, recovery: 50, learning: 50, boundaries: 50 },
  noise: 0.35,
};

/** Sensitivity weights wi (kept for API back-compat / ranking heuristics). */
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

/** Distinct colors per factor (colour-blind assist via linestyles in charts). */
export const VARIABLE_COLORS: Record<VariableKey, string> = {
  action: "#f59e0b",     // amber
  recovery: "#38bdf8",   // sky
  learning: "#a78bfa",   // violet
  boundaries: "#34d399", // emerald
};

export const BASELINE_COLOR = "#e2c078";
export const CYCLE_COLOR = "#fcd34d";
export const TOTAL_COLOR = "#fde68a";

export const PRESETS = {
  balanced: {
    id: "balanced",
    label: { zh: "资源均衡", en: "Balanced" },
    variables: { action: 55, recovery: 55, learning: 55, boundaries: 55 },
  },
  overload: {
    id: "overload",
    label: { zh: "高投入低恢复", en: "High-action, low-recovery" },
    variables: { action: 85, recovery: 25, learning: 55, boundaries: 45 },
  },
  restorative: {
    id: "restorative",
    label: { zh: "低投入高恢复", en: "Low-action, high-recovery" },
    variables: { action: 30, recovery: 80, learning: 65, boundaries: 60 },
  },
} as const;

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
/* Legacy per-point shape (kept for existing chart + tests)           */
/* ------------------------------------------------------------------ */

export type LifePoint = {
  age: number;
  baseline: number;    // seedBaseline + cycle
  scenario: number;    // total = baseline + sum(factors), clamped
  bandLow: number;
  bandHigh: number;
  cycle: number;       // C(t) only
  choiceDelta: number; // Σ Fi(t) at age
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
  return (c1 * 0.55 + c2 * 0.45) * 12;
}

/* ------------------------------------------------------------------ */
/* Per-factor time shapes                                              */
/* ------------------------------------------------------------------ */

/** normalized time in [0, 1] over the demo 0..80 window. */
function tNorm(age: number): number {
  return clamp(age / 80, 0, 1.2);
}

/** Action wave — strong early, mild diminish long-term. */
function actionContribution(age: number, cA: number): number {
  const t = tNorm(age);
  return cA * 6.0 * (1 - 0.25 * Math.min(t, 1));
}

/** Overload penalty — kicks in only if high action AND low recovery. */
function overloadPenalty(age: number, cA: number, cR: number): number {
  if (cA <= 0.15 || cR >= -0.15) return 0;
  const t = tNorm(age);
  const intensity = Math.min(cA, -cR); // both in (0, 1]
  return -intensity * 5 * (0.3 + 0.7 * Math.min(t, 1));
}

/** Recovery — gentle early, stronger stability over time. */
function recoveryContribution(age: number, cR: number): number {
  const t = tNorm(age);
  return cR * 5.0 * (0.4 + 0.6 * Math.min(t, 1));
}

/** Learning — compound over time, capped. */
function learningContribution(age: number, cL: number): number {
  const t = tNorm(age);
  const raw = 9 * Math.pow(Math.min(t, 1), 1.4);
  const magnitude = Math.min(7, raw);
  return cL * magnitude;
}

/** Boundaries — protects more when cycle stress is high. */
function boundariesContribution(cycle: number, cB: number): number {
  const stress = Math.min(1, Math.abs(cycle) / 12);
  return cB * (1.2 + 3.0 * stress);
}

/** How much recovery narrows the uncertainty band (multiplier 0.4..1.4). */
function bandScale(cR: number): number {
  return clamp(1 - 0.4 * cR, 0.4, 1.4);
}

/* ------------------------------------------------------------------ */
/* Legacy series builder — unchanged shape, new math internally.       */
/* ------------------------------------------------------------------ */

function centered(v: number): number {
  return (v - 50) / 50;
}

function factorAt(
  key: FactorKey,
  age: number,
  cycle: number,
  cA: number,
  cR: number,
  cL: number,
  cB: number,
): number {
  switch (key) {
    case "action":
      return actionContribution(age, cA) + overloadPenalty(age, cA, cR);
    case "recovery":
      return recoveryContribution(age, cR);
    case "learning":
      return learningContribution(age, cL);
    case "boundaries":
      return boundariesContribution(cycle, cB);
  }
}

export function buildLifeSeries(input: BuildInput): LifePoint[] {
  const { seed, fromAge, toAge, scenario } = input;
  if (!Number.isFinite(fromAge) || !Number.isFinite(toAge) || toAge < fromAge) return [];
  const { baseline, phase1, phase2 } = seedFromString(seed);
  const cA = centered(scenario.variables.action);
  const cR = centered(scenario.variables.recovery);
  const cL = centered(scenario.variables.learning);
  const cB = centered(scenario.variables.boundaries);
  const noise = clamp(scenario.noise, 0, 1);
  const halfBase = noise * 12 * bandScale(cR);
  const out: LifePoint[] = [];
  for (let a = Math.floor(fromAge); a <= Math.ceil(toAge); a += 1) {
    const c = cycleAt(a, phase1, phase2);
    const fA = factorAt("action", a, c, cA, cR, cL, cB);
    const fR = factorAt("recovery", a, c, cA, cR, cL, cB);
    const fL = factorAt("learning", a, c, cA, cR, cL, cB);
    const fB = factorAt("boundaries", a, c, cA, cR, cL, cB);
    const delta = fA + fR + fL + fB;
    const base = clamp(baseline + c);
    const scen = clamp(baseline + c + delta);
    out.push({
      age: a,
      baseline: Number(base.toFixed(2)),
      scenario: Number(scen.toFixed(2)),
      bandLow: Number(clamp(scen - halfBase).toFixed(2)),
      bandHigh: Number(clamp(scen + halfBase).toFixed(2)),
      cycle: Number(c.toFixed(2)),
      choiceDelta: Number(delta.toFixed(2)),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Decomposed composition — for the new synthesizer UI.                */
/* ------------------------------------------------------------------ */

export type Composition = {
  ages: number[];
  seedBaseline: number;           // B, constant per age
  baselineSeries: number[];       // B (repeated)
  cycleSeries: number[];          // C(t)
  factorSeries: Record<FactorKey, number[]>;
  totalSeries: number[];          // clamped B + C + ΣF
  bandLow: number[];
  bandHigh: number[];
  interactionFlags: {
    overload: boolean;
    overloadAges: number[];
  };
};

export function buildComposition(input: BuildInput): Composition {
  const { seed, fromAge, toAge, scenario } = input;
  const ages: number[] = [];
  const baselineSeries: number[] = [];
  const cycleSeries: number[] = [];
  const factorSeries: Record<FactorKey, number[]> = {
    action: [], recovery: [], learning: [], boundaries: [],
  };
  const totalSeries: number[] = [];
  const bandLow: number[] = [];
  const bandHigh: number[] = [];
  const overloadAges: number[] = [];

  if (!Number.isFinite(fromAge) || !Number.isFinite(toAge) || toAge < fromAge) {
    return {
      ages, seedBaseline: 0, baselineSeries, cycleSeries, factorSeries,
      totalSeries, bandLow, bandHigh,
      interactionFlags: { overload: false, overloadAges },
    };
  }

  const { baseline, phase1, phase2 } = seedFromString(seed);
  const cA = centered(scenario.variables.action);
  const cR = centered(scenario.variables.recovery);
  const cL = centered(scenario.variables.learning);
  const cB = centered(scenario.variables.boundaries);
  const noise = clamp(scenario.noise, 0, 1);
  const halfBase = noise * 12 * bandScale(cR);
  const overloadActive = cA > 0.15 && cR < -0.15;

  for (let a = Math.floor(fromAge); a <= Math.ceil(toAge); a += 1) {
    const c = cycleAt(a, phase1, phase2);
    const fA = factorAt("action", a, c, cA, cR, cL, cB);
    const fR = factorAt("recovery", a, c, cA, cR, cL, cB);
    const fL = factorAt("learning", a, c, cA, cR, cL, cB);
    const fB = factorAt("boundaries", a, c, cA, cR, cL, cB);
    const total = clamp(baseline + c + fA + fR + fL + fB);
    ages.push(a);
    baselineSeries.push(Number(baseline.toFixed(2)));
    cycleSeries.push(Number(c.toFixed(2)));
    factorSeries.action.push(Number(fA.toFixed(2)));
    factorSeries.recovery.push(Number(fR.toFixed(2)));
    factorSeries.learning.push(Number(fL.toFixed(2)));
    factorSeries.boundaries.push(Number(fB.toFixed(2)));
    totalSeries.push(Number(total.toFixed(2)));
    bandLow.push(Number(clamp(total - halfBase).toFixed(2)));
    bandHigh.push(Number(clamp(total + halfBase).toFixed(2)));
    if (overloadActive && overloadPenalty(a, cA, cR) < -0.5) overloadAges.push(a);
  }

  return {
    ages,
    seedBaseline: Number(baseline.toFixed(2)),
    baselineSeries,
    cycleSeries,
    factorSeries,
    totalSeries,
    bandLow,
    bandHigh,
    interactionFlags: {
      overload: overloadActive && overloadAges.length > 0,
      overloadAges,
    },
  };
}

export type FocusContributions = {
  age: number;
  baseline: number;
  cycle: number;
  factors: Record<FactorKey, number>;
  total: number;
};

export function contributionsAt(
  focusAge: number,
  composition: Composition,
): FocusContributions | null {
  const idx = composition.ages.indexOf(focusAge);
  if (idx < 0) return null;
  return {
    age: focusAge,
    baseline: composition.baselineSeries[idx],
    cycle: composition.cycleSeries[idx],
    factors: {
      action: composition.factorSeries.action[idx],
      recovery: composition.factorSeries.recovery[idx],
      learning: composition.factorSeries.learning[idx],
      boundaries: composition.factorSeries.boundaries[idx],
    },
    total: composition.totalSeries[idx],
  };
}

/* ------------------------------------------------------------------ */
/* Sensitivity + curator note                                          */
/* ------------------------------------------------------------------ */

/**
 * Per-variable sensitivity: how much the total at the focus age moves
 * when that variable alone shifts by +25 points from its current value.
 */
export function sensitivityAt(
  focusAge: number,
  seed: string,
  scenario: MathScenario,
): Record<VariableKey, number> {
  const out = {} as Record<VariableKey, number>;
  const base = buildLifeSeries({ seed, fromAge: focusAge, toAge: focusAge, scenario })[0]?.scenario ?? 0;
  for (const k of Object.keys(VARIABLE_WEIGHTS) as VariableKey[]) {
    const bumped: MathScenario = {
      ...scenario,
      variables: { ...scenario.variables, [k]: clamp(scenario.variables[k] + 25) },
    };
    const y = buildLifeSeries({ seed, fromAge: focusAge, toAge: focusAge, scenario: bumped })[0]?.scenario ?? 0;
    out[k] = Number(Math.abs(y - base).toFixed(2));
  }
  return out;
}

function magnitudeWord(v: number, lang: "zh" | "en"): string {
  const abs = Math.abs(v);
  if (lang === "zh") return abs < 0.8 ? "轻微" : abs < 2.5 ? "明显" : "强";
  return abs < 0.8 ? "slight" : abs < 2.5 ? "clear" : "strong";
}

/**
 * Three-part rule-generated curator note:
 *   1) who is pushing / pulling the curve now,
 *   2) any interaction effect (e.g. overload),
 *   3) one small tweak suggestion with a simulated delta.
 */
export function curatorSummary(
  focusAge: number,
  seed: string,
  scenario: MathScenario,
  lang: "zh" | "en",
): string {
  const comp = buildComposition({ seed, fromAge: focusAge, toAge: focusAge, scenario });
  const f = contributionsAt(focusAge, comp);
  if (!f) return lang === "zh" ? "尚无数据可解释。" : "No data to interpret yet.";

  const factorEntries = (Object.keys(f.factors) as FactorKey[])
    .map((k) => ({ k, v: f.factors[k] }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const pushing = factorEntries.filter((e) => e.v > 0.3).slice(0, 2);
  const pulling = factorEntries.filter((e) => e.v < -0.3).slice(0, 2);

  const label = (k: FactorKey) => VARIABLE_LABELS[k][lang];
  const list = (arr: { k: FactorKey; v: number }[]) =>
    arr.map((e) => `${label(e.k)}(${e.v > 0 ? "+" : ""}${e.v.toFixed(1)})`).join(lang === "zh" ? "、" : ", ");

  const line1Zh = pushing.length || pulling.length
    ? `在 ${focusAge} 岁，${pushing.length ? `${list(pushing)} 正在把曲线抬高` : ""}${pushing.length && pulling.length ? "；" : ""}${pulling.length ? `${list(pulling)} 在压低曲线` : ""}。`
    : `在 ${focusAge} 岁，各因素接近平衡，曲线贴近基线。`;
  const line1En = pushing.length || pulling.length
    ? `At age ${focusAge}, ${pushing.length ? `${list(pushing)} push the curve up` : ""}${pushing.length && pulling.length ? "; " : ""}${pulling.length ? `${list(pulling)} pull it down` : ""}.`
    : `At age ${focusAge}, factors are near balance and the curve tracks the baseline.`;

  const line2Zh = comp.interactionFlags.overload
    ? "组合效应：高行动 × 低恢复形成了过载回落，长期会削弱行动本身的贡献。"
    : "组合效应：当前没有明显的过载或互相抵消。";
  const line2En = comp.interactionFlags.overload
    ? "Interaction: high action combined with low recovery is triggering an overload dip that erodes action's own gains long-term."
    : "Interaction: no clear overload or cancellation between factors right now.";

  const sens = sensitivityAt(focusAge, seed, scenario);
  const leader = (Object.keys(sens) as VariableKey[]).sort((a, b) => sens[b] - sens[a])[0];
  const current = scenario.variables[leader];
  const suggested = clamp(current + (scenario.variables.recovery < 40 && leader === "recovery" ? 15 : 10));
  const mag = magnitudeWord(sens[leader], lang);
  const line3Zh = `一步小调整：把「${label(leader)}」从 ${current} 调到 ${suggested}，模拟对当前年龄的影响约为 ${mag}（±${sens[leader].toFixed(1)}）。`;
  const line3En = `One small tweak: move "${label(leader)}" from ${current} to ${suggested}; the simulated effect at this age is ${mag} (±${sens[leader].toFixed(1)}).`;

  const caveatZh = "这是规则生成的解释性分值，不是科学预测，也不能替代专业建议。";
  const caveatEn = "These are rule-generated interpretive scores, not scientific predictions and not a substitute for professional advice.";

  return lang === "zh"
    ? `${line1Zh}\n${line2Zh}\n${line3Zh}\n${caveatZh}`
    : `${line1En}\n${line2En}\n${line3En}\n${caveatEn}`;
}

/** Convenience: seed string builder used by the room. */
export function seedForChart(birthISO: string | null | undefined, fallback = "demo"): string {
  if (!birthISO) return fallback;
  const d = new Date(birthISO);
  if (Number.isNaN(d.getTime())) return fallback;
  return `chart:${birthISO}`;
}

/**
 * Immediate rule-based reaction to a user slider change.
 * No AI, no async. Returns a one-line sentence in the requested lang.
 */
export function reactionForChange(
  key: VariableKey,
  from: number,
  to: number,
  focusAge: number,
  seed: string,
  scenario: MathScenario,
  lang: "zh" | "en",
): string {
  const before = buildComposition({ seed, fromAge: focusAge, toAge: focusAge, scenario });
  const nextScenario: MathScenario = {
    ...scenario,
    variables: { ...scenario.variables, [key]: to },
  };
  const after = buildComposition({ seed, fromAge: focusAge, toAge: focusAge, scenario: nextScenario });
  const dTotal = (after.totalSeries[0] ?? 0) - (before.totalSeries[0] ?? 0);
  const dBand =
    ((after.bandHigh[0] ?? 0) - (after.bandLow[0] ?? 0)) -
    ((before.bandHigh[0] ?? 0) - (before.bandLow[0] ?? 0));
  const label = VARIABLE_LABELS[key][lang];
  const direction = to > from ? (lang === "zh" ? "调高" : "raised") : (lang === "zh" ? "调低" : "lowered");
  if (lang === "zh") {
    if (key === "recovery") {
      return `你刚${direction}了「${label}」：曲线${dTotal >= 0 ? "略被抬起" : "略被压低"} ${Math.abs(dTotal).toFixed(1)}，不确定带宽度变化 ${dBand.toFixed(1)}。`;
    }
    if (key === "learning") {
      return `你刚${direction}了「${label}」：短期变化很小，随年龄增长会逐渐累积。当前年龄变化 ${dTotal.toFixed(1)}。`;
    }
    if (key === "action") {
      return `你刚${direction}了「${label}」：曲线${dTotal >= 0 ? "被推高" : "被压低"} ${Math.abs(dTotal).toFixed(1)}${before.interactionFlags.overload || after.interactionFlags.overload ? "；注意：当前存在“行动过载”反效果。" : "。"}`;
    }
    return `你刚${direction}了「${label}」：曲线在压力周期中的效果最明显，当前年龄变化 ${dTotal.toFixed(1)}。`;
  }
  if (key === "recovery") {
    return `You ${direction} "${label}": the curve moved ${dTotal >= 0 ? "up" : "down"} by ${Math.abs(dTotal).toFixed(1)}, uncertainty band width changed by ${dBand.toFixed(1)}.`;
  }
  if (key === "learning") {
    return `You ${direction} "${label}": short-term change is small; the compounding lift grows with age. Change at this age: ${dTotal.toFixed(1)}.`;
  }
  if (key === "action") {
    return `You ${direction} "${label}": the curve moved ${dTotal >= 0 ? "up" : "down"} by ${Math.abs(dTotal).toFixed(1)}${before.interactionFlags.overload || after.interactionFlags.overload ? "; heads up — an action-overload counter-effect is active." : "."}`;
  }
  return `You ${direction} "${label}": it protects most during cycle stress. Change at this age: ${dTotal.toFixed(1)}.`;
}
