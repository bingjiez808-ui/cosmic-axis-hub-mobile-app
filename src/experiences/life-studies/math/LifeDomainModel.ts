/**
 * Deterministic seven-domain life-line model.
 *
 * Pure functions. No AI, no I/O. Given identical SupportedFacts + the same
 * age window, output is bit-identical (numbers rounded to 2 decimals).
 *
 * Design notes:
 *   • Domain base = neutral 50 + a small seed-derived variance + wuxing tilt.
 *   • Age shape per domain reflects broad life-stage patterns (study peaks
 *     young, wealth-risk capacity rises with age, health slowly declines).
 *   • Period modifiers come from bazi 大运 / ziwei 大限 / vedic mahadasha
 *     boundaries. Each boundary "flips" a small pseudo-random tilt per
 *     domain — the tilt is deterministic (hash of seed + boundary index +
 *     domain), so the same person always sees the same story.
 *   • Cross-domain effects apply AFTER per-domain scoring:
 *       career high + health low  → realisability cap on top 2 domains
 *       study high                 → career choice-space +, lagged 3 years
 *       family high                → wealthRisk (risk tolerance) −
 *       social low                 → career execution-cost friction
 *       wealthRisk high            → family safety −
 *   • Composite = weighted mean, then multiplied by a health realisability
 *     factor that damps runaway highs when health is below 45.
 */

import {
  COMPOSITE_WEIGHTS,
  DOMAIN_KEYS,
  type DomainKey,
} from "./domains";
import {
  DEMO_FACTS,
  factsFromSeed,
  type SupportedFacts,
} from "./demoFacts";
import {
  confidenceFor,
  coverageFor,
  makeRef,
  resolveEvidence,
  type Confidence,
  type DataCoverage,
} from "./evidence";

/** Bump this whenever the scoring formula changes so caches invalidate. */
export const LIFE_DOMAIN_MODEL_VERSION = "life-domain@1";

export type BuildDomainInput = {
  facts?: SupportedFacts;
  seed?: string;
  mode: "demo" | "personal";
  fromAge: number;
  toAge: number;
};

export type DomainSeries = Record<DomainKey, number[]>;

export type TurningPoint = {
  age: number;
  domain: DomainKey | "composite";
  delta: number;
  /** Which boundary triggered this. Present iff a system boundary aligns. */
  evidenceRef: string;
};

export type BuildDomainResult = {
  version: string;
  facts: SupportedFacts;
  ages: number[];
  domainSeries: DomainSeries;
  compositeSeries: number[];
  turningPoints: TurningPoint[];
  dataCoverage: DataCoverage;
};

export type DomainSignal = {
  kind: "positive" | "friction";
  text: { zh: string; en: string };
  evidenceRefs: string[];
};

export type DomainSnapshotEntry = {
  score: number;
  band: [number, number];
  positiveSignals: DomainSignal[];
  frictionSignals: DomainSignal[];
  evidenceRefs: string[];
  confidence: Confidence;
  dataCoverage: DataCoverage;
};

export type AgeSnapshot = {
  age: number;
  facts: SupportedFacts;
  domains: Record<DomainKey, DomainSnapshotEntry>;
  composite: number;
  dominantDomain: DomainKey;
  topFriction: DomainKey;
  dataCoverage: DataCoverage;
};

export type CrossDomainArrow = {
  from: DomainKey;
  to: DomainKey;
  delta: number;
  label: { zh: string; en: string };
};

export type ScenarioChoiceKind = "career" | "study" | "love" | "family" | "wealth";
export type ScenarioBranch = {
  id: string;
  label: { zh: string; en: string };
  perYearDeltas: Array<Partial<Record<DomainKey, number>>>;
  reversibility: "high" | "medium" | "low";
  resourceCost: "low" | "medium" | "high";
  pressure: "low" | "medium" | "high";
  cycleFit: "aligned" | "neutral" | "against";
  note: { zh: string; en: string };
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Deterministic tilt in [-1, 1] for (seed, domain, period). */
function tilt(seed: string, domain: DomainKey, period: number): number {
  const h = fnv1a(`${seed}|${domain}|${period}`);
  return (((h & 0xffff) / 0xffff) - 0.5) * 2;
}

/** Age-shape prior per domain: returns a delta in [-15, +15] added to 50. */
function ageShape(domain: DomainKey, age: number): number {
  switch (domain) {
    case "study": {
      // High until 25, taper to 30% by 60.
      if (age < 6) return -10;
      if (age < 25) return 10 - (age - 6) * 0.2;
      return 10 - Math.min(15, (age - 25) * 0.4);
    }
    case "career": {
      // Ramps 22→45, plateau, decline 60+.
      if (age < 22) return -8 + (age / 22) * 8;
      if (age < 45) return ((age - 22) / 23) * 12;
      if (age < 60) return 12 - ((age - 45) / 15) * 4;
      return 8 - Math.min(18, (age - 60) * 0.5);
    }
    case "love": {
      // Bimodal peaks at 28 and 50.
      const g1 = Math.exp(-((age - 28) ** 2) / 60) * 10;
      const g2 = Math.exp(-((age - 50) ** 2) / 90) * 6;
      return g1 + g2 - 5;
    }
    case "family": {
      // Rises 25→50, high plateau, mellow taper.
      if (age < 25) return -6 + (age / 25) * 4;
      if (age < 50) return -2 + ((age - 25) / 25) * 12;
      return 10 - Math.max(0, (age - 60) * 0.15);
    }
    case "social": {
      // Rolling waves.
      return Math.sin(age / 4) * 4 + Math.cos(age / 9) * 3;
    }
    case "wealthRisk": {
      // Capacity to shoulder risk rises with age until ~50, then contracts.
      if (age < 22) return -8;
      if (age < 50) return -8 + ((age - 22) / 28) * 18;
      return 10 - ((age - 50) / 30) * 12;
    }
    case "health": {
      // Slow gentle decline, small recovery bumps every ~11 years.
      const decline = -Math.min(18, age * 0.22);
      const bump = Math.sin((age / 11) * Math.PI * 2) * 3;
      return decline + bump;
    }
  }
}

function wuxingTilt(domain: DomainKey, facts: SupportedFacts): number {
  const w = facts.wuxing;
  switch (domain) {
    case "study":      return (w.water + w.wood - 0.4) * 15;
    case "career":     return (w.metal + w.fire - 0.4) * 15;
    case "love":       return (w.water + w.fire - 0.4) * 15;
    case "family":     return (w.earth + w.wood - 0.4) * 15;
    case "social":     return (w.fire + w.metal - 0.4) * 12;
    case "wealthRisk": return (w.metal + w.earth - 0.4) * 15;
    case "health":     return (w.water + w.earth - 0.4) * 15;
  }
}

/** Which "period index" the age sits in for each system. */
function periodIndex(boundaries: number[], age: number): number {
  let i = 0;
  while (i < boundaries.length && age >= boundaries[i]) i += 1;
  return i;
}

function baseScore(domain: DomainKey, age: number, facts: SupportedFacts): number {
  const p1 = periodIndex(facts.daYunBoundaries, age);
  const p2 = periodIndex(facts.ziweiLimitBoundaries, age);
  const md = facts.mahadasha.find((m) => age >= m.from && age < m.to);
  const mdIdx = md ? facts.mahadasha.indexOf(md) : 0;

  const t1 = tilt(facts.seed, domain, p1) * 6;
  const t2 = tilt(`${facts.seed}#z`, domain, p2) * 5;
  const t3 = tilt(`${facts.seed}#v`, domain, mdIdx) * 4;

  // Western natal-only contributes a static aspect tilt (does NOT vary by age).
  const aspects = facts.westernAspects;
  const asp = aspects.harmonious - aspects.challenging;
  const westernTilt =
    domain === "love"  ? asp * 0.6 :
    domain === "career" ? asp * 0.4 :
    domain === "health" ? asp * 0.3 : asp * 0.2;

  return 50 + ageShape(domain, age) + wuxingTilt(domain, facts) + t1 + t2 + t3 + westernTilt;
}

/* ------------------------------------------------------------------ */
/* Cross-domain effects                                                */
/* ------------------------------------------------------------------ */

function applyCrossDomainEffects(
  raw: Record<DomainKey, number>,
  history: Record<DomainKey, number> | null,
): Record<DomainKey, number> {
  const out = { ...raw };

  // 1. Study accumulation (3y lagged) → career choice-space +.
  if (history && history.study > 60) out.career += (history.study - 60) * 0.12;

  // 2. Family responsibility high → wealthRisk capacity −.
  if (raw.family > 65) out.wealthRisk -= (raw.family - 65) * 0.2;

  // 3. Wealth risk exposure high → family safety −.
  if (raw.wealthRisk > 70) out.family -= (raw.wealthRisk - 70) * 0.25;

  // 4. Social friction (low social) → career execution cost.
  if (raw.social < 45) out.career -= (45 - raw.social) * 0.2;

  // 5. Career pressure high + health low → health & family additional drag.
  if (raw.career > 70 && raw.health < 55) {
    const stress = (raw.career - 70) + (55 - raw.health);
    out.health -= stress * 0.15;
    out.family -= stress * 0.08;
  }

  // 6. Realisability cap: when health is low, damp the top-2 domains.
  if (out.health < 50) {
    const damp = (50 - out.health) * 0.25;
    const sorted = (Object.keys(out) as DomainKey[])
      .filter((k) => k !== "health")
      .sort((a, b) => out[b] - out[a]);
    out[sorted[0]] -= damp;
    out[sorted[1]] -= damp * 0.6;
  }

  for (const k of DOMAIN_KEYS) out[k] = clamp(out[k]);
  return out;
}

/**
 * Compute the arrows to display at a specific age snapshot. Only arrows
 * whose rule actually fired at that age are returned.
 */
export function crossDomainEffects(snapshot: AgeSnapshot): CrossDomainArrow[] {
  const d = snapshot.domains;
  const arrows: CrossDomainArrow[] = [];
  const raw: Record<DomainKey, number> = {} as Record<DomainKey, number>;
  for (const k of DOMAIN_KEYS) raw[k] = d[k].score;

  if (raw.career > 65 && raw.health < 60) {
    arrows.push({
      from: "career", to: "health",
      delta: -Number((((raw.career - 65) + (60 - raw.health)) * 0.15).toFixed(1)),
      label: { zh: "事业压力 → 健康可兑现度", en: "Career pressure → health realisability" },
    });
  }
  if (raw.study > 60) {
    arrows.push({
      from: "study", to: "career",
      delta: +Number(((raw.study - 60) * 0.12).toFixed(1)),
      label: { zh: "学业积累 → 事业选择空间", en: "Study accumulation → career choice-space" },
    });
  }
  if (raw.family > 65) {
    arrows.push({
      from: "family", to: "wealthRisk",
      delta: -Number(((raw.family - 65) * 0.2).toFixed(1)),
      label: { zh: "家庭责任 → 风险承受空间", en: "Family duty → risk-tolerance headroom" },
    });
  }
  if (raw.wealthRisk > 70) {
    arrows.push({
      from: "wealthRisk", to: "family",
      delta: -Number(((raw.wealthRisk - 70) * 0.25).toFixed(1)),
      label: { zh: "风险暴露 → 家庭安全感", en: "Risk exposure → family safety" },
    });
  }
  if (raw.social < 45) {
    arrows.push({
      from: "social", to: "career",
      delta: -Number(((45 - raw.social) * 0.2).toFixed(1)),
      label: { zh: "协作摩擦 → 事业执行成本", en: "Collab friction → career execution cost" },
    });
  }
  return arrows.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Series builder                                                      */
/* ------------------------------------------------------------------ */

export function resolveFacts(input: BuildDomainInput): SupportedFacts {
  if (input.facts) return input.facts;
  if (input.mode === "personal" && input.seed) return factsFromSeed(input.seed);
  return DEMO_FACTS;
}

export function buildDomainSeries(input: BuildDomainInput): BuildDomainResult {
  const facts = resolveFacts(input);
  const ages: number[] = [];
  const domainSeries: DomainSeries = {
    study: [], career: [], love: [], family: [], social: [], wealthRisk: [], health: [],
  };
  const compositeSeries: number[] = [];
  const turningPoints: TurningPoint[] = [];

  if (
    !Number.isFinite(input.fromAge) || !Number.isFinite(input.toAge) ||
    input.toAge < input.fromAge
  ) {
    return {
      version: LIFE_DOMAIN_MODEL_VERSION,
      facts, ages, domainSeries, compositeSeries, turningPoints,
      dataCoverage: coverageFor(facts),
    };
  }

  const from = Math.floor(input.fromAge);
  const to = Math.ceil(input.toAge);
  const buffer: Record<DomainKey, number>[] = [];

  for (let a = from; a <= to; a += 1) {
    const raw: Record<DomainKey, number> = {} as Record<DomainKey, number>;
    for (const k of DOMAIN_KEYS) raw[k] = baseScore(k, a, facts);
    const lag = a >= from + 3 ? buffer[a - from - 3] : null;
    const adjusted = applyCrossDomainEffects(raw, lag);
    ages.push(a);
    let composite = 0;
    for (const k of DOMAIN_KEYS) {
      domainSeries[k].push(round2(adjusted[k]));
      composite += adjusted[k] * COMPOSITE_WEIGHTS[k];
    }
    // Health realisability adjustment on composite when health is very low.
    if (adjusted.health < 45) composite *= 0.9 + (adjusted.health / 45) * 0.1;
    compositeSeries.push(round2(clamp(composite)));
    buffer.push(adjusted);
  }

  // Turning points: composite jump AND aligned to a system boundary.
  const boundaryAges = new Set<number>([
    ...facts.daYunBoundaries,
    ...facts.ziweiLimitBoundaries,
    ...facts.mahadasha.map((m) => m.from),
  ]);
  for (let i = 1; i < ages.length; i += 1) {
    const delta = compositeSeries[i] - compositeSeries[i - 1];
    const age = ages[i];
    if (Math.abs(delta) >= 1.4 && boundaryAges.has(age)) {
      const evidenceRef =
        facts.daYunBoundaries.includes(age)      ? makeRef("bazi",   "dayun-boundary",   age) :
        facts.ziweiLimitBoundaries.includes(age) ? makeRef("ziwei",  "limit-boundary",   age) :
                                                    makeRef("vedic",  "mahadasha",        age);
      turningPoints.push({
        age, domain: "composite", delta: round2(delta), evidenceRef,
      });
    }
  }

  return {
    version: LIFE_DOMAIN_MODEL_VERSION,
    facts,
    ages,
    domainSeries,
    compositeSeries,
    turningPoints,
    dataCoverage: coverageFor(facts),
  };
}

/* ------------------------------------------------------------------ */
/* Age snapshot                                                        */
/* ------------------------------------------------------------------ */

const POSITIVE_TEMPLATES: Record<DomainKey, { zh: string; en: string }[]> = {
  study:      [{ zh: "适合结构化学习与整理旧知识", en: "Good window for structured study and consolidating past knowledge" }],
  career:     [{ zh: "选择空间相对开阔，可试点新方向", en: "Choice-space is comparatively open; pilot a new direction" }],
  love:       [{ zh: "沟通与信任修复的窗口", en: "Window for communication and trust repair" }],
  family:     [{ zh: "承担与协商更容易被接住", en: "Support for shared responsibilities is easier to receive" }],
  social:     [{ zh: "同伴与协作资源相对充足", en: "Peer and collaboration resources are relatively rich" }],
  wealthRisk: [{ zh: "风险管理环境相对宽松，可复盘配置", en: "Risk-management climate is more accommodating; review allocation" }],
  health:     [{ zh: "作息与恢复更容易见效", en: "Sleep and recovery routines respond well" }],
};

const FRICTION_TEMPLATES: Record<DomainKey, { zh: string; en: string }[]> = {
  study:      [{ zh: "注意力分散风险偏高，优先减法", en: "Attention fragmentation risk is higher; subtract before adding" }],
  career:     [{ zh: "执行成本上升，避免同时多线扩张", en: "Execution cost rises; avoid parallel expansions" }],
  love:       [{ zh: "情绪解读偏差易升级为冲突", en: "Misreads escalate quickly; slow the loop" }],
  family:     [{ zh: "责任分配需要重新协商", en: "Renegotiate the split of responsibilities" }],
  social:     [{ zh: "合作摩擦 / 权责不清 / 信息不对称风险偏高", en: "Higher risk of collaboration friction, unclear ownership, or information asymmetry" }],
  wealthRisk: [{ zh: "风险承受空间收窄，慎加杠杆", en: "Risk-tolerance headroom narrows; be cautious with leverage" }],
  health:     [{ zh: "恢复不足累积，安排就医与休整提醒", en: "Recovery debt accumulating; schedule check-ups and rest" }],
};

function bandFor(score: number, confidence: Confidence): [number, number] {
  const w = confidence === "high" ? 5 : confidence === "medium" ? 8 : 12;
  return [Number(clamp(score - w).toFixed(1)), Number(clamp(score + w).toFixed(1))];
}

export function ageSnapshot(
  age: number,
  result: BuildDomainResult,
): AgeSnapshot | null {
  const idx = result.ages.indexOf(age);
  if (idx < 0) return null;
  const facts = result.facts;
  const domains = {} as Record<DomainKey, DomainSnapshotEntry>;
  let dominant: DomainKey = "career";
  let dominantScore = -Infinity;
  let friction: DomainKey = "career";
  let frictionScore = Infinity;
  for (const k of DOMAIN_KEYS) {
    const score = result.domainSeries[k][idx];
    const confidence = confidenceFor(facts, k);
    const positive: DomainSignal[] = score >= 58
      ? [{ kind: "positive", text: POSITIVE_TEMPLATES[k][0], evidenceRefs: [makeRef("bazi", "dayun-boundary", age)] }]
      : [];
    const frictionSignals: DomainSignal[] = score <= 45
      ? [{ kind: "friction", text: FRICTION_TEMPLATES[k][0], evidenceRefs: [makeRef("ziwei", "limit-boundary", age)] }]
      : [];
    const refs = [
      makeRef("bazi", "wuxing"),
      makeRef("bazi", "dayun-boundary", age),
      makeRef("ziwei", "limit-boundary", age),
      makeRef("vedic", "mahadasha", age),
      makeRef("western", "aspects"),
    ];
    domains[k] = {
      score, band: bandFor(score, confidence),
      positiveSignals: positive,
      frictionSignals,
      evidenceRefs: refs,
      confidence,
      dataCoverage: result.dataCoverage,
    };
    if (score > dominantScore) { dominantScore = score; dominant = k; }
    if (score < frictionScore) { frictionScore = score; friction = k; }
  }
  return {
    age,
    facts,
    domains,
    composite: result.compositeSeries[idx],
    dominantDomain: dominant,
    topFriction: friction,
    dataCoverage: result.dataCoverage,
  };
}

/* ------------------------------------------------------------------ */
/* Scenario branches                                                   */
/* ------------------------------------------------------------------ */

const CHOICE_LIBRARY: Record<
  ScenarioChoiceKind,
  Array<Omit<ScenarioBranch, "perYearDeltas"> & { deltas: Partial<Record<DomainKey, number>> }>
> = {
  career: [
    { id: "deepen",  label: { zh: "继续深耕",   en: "Deepen current role" }, deltas: { career: +3, wealthRisk: +1, health: -1 }, reversibility: "high",   resourceCost: "low",    pressure: "low",    cycleFit: "aligned", note: { zh: "短期成本低，长期上限受经验壁垒影响", en: "Lower short-term cost; long-term ceiling depends on tenure moat" } },
    { id: "switch",  label: { zh: "转岗转行",   en: "Switch role / industry" }, deltas: { career: -2, study: +4, wealthRisk: -3, family: -2, health: -2 }, reversibility: "low",  resourceCost: "high",  pressure: "high", cycleFit: "neutral", note: { zh: "可逆性低，需家庭与健康缓冲", en: "Low reversibility; needs family and health buffers" } },
    { id: "sidebet", label: { zh: "副业试验",   en: "Small side bet" }, deltas: { career: +1, study: +2, wealthRisk: -1, health: -1 }, reversibility: "high", resourceCost: "medium", pressure: "medium", cycleFit: "aligned", note: { zh: "保留主线，试验新路径可逆", en: "Keeps the mainline; the side path stays reversible" } },
  ],
  study: [
    { id: "degree",  label: { zh: "继续升学",   en: "Continue formal study" }, deltas: { study: +5, career: -2, wealthRisk: -3, family: -1 }, reversibility: "medium", resourceCost: "high",  pressure: "medium", cycleFit: "neutral", note: { zh: "长期回报强，但短期挤占其它资源", en: "Strong long-run payoff; short-run squeeze on other domains" } },
    { id: "cert",    label: { zh: "技能证书",   en: "Skill certification" }, deltas: { study: +3, career: +2 }, reversibility: "high", resourceCost: "medium", pressure: "low", cycleFit: "aligned", note: { zh: "轻量、可逆，与事业互补", en: "Lightweight and reversible; complements career" } },
    { id: "project", label: { zh: "项目实践",   en: "Project practice" }, deltas: { study: +2, social: +2, career: +1 }, reversibility: "high", resourceCost: "low", pressure: "low", cycleFit: "aligned", note: { zh: "以做代学，快速反馈", en: "Learn by doing; quick feedback" } },
  ],
  love: [
    { id: "repair",  label: { zh: "修复沟通",   en: "Repair communication" }, deltas: { love: +3, family: +1, health: +1 }, reversibility: "high", resourceCost: "low", pressure: "low", cycleFit: "aligned", note: { zh: "低成本，易复盘", en: "Low cost, easy to review" } },
    { id: "pause",   label: { zh: "暂缓承诺",   en: "Pause commitment" }, deltas: { love: -1, health: +1 }, reversibility: "high", resourceCost: "low", pressure: "low", cycleFit: "neutral", note: { zh: "留出观察窗口", en: "Leaves a window for observation" } },
    { id: "explore", label: { zh: "探索新关系", en: "Explore new connection" }, deltas: { love: +2, social: +2, family: -1, health: -1 }, reversibility: "medium", resourceCost: "medium", pressure: "medium", cycleFit: "neutral", note: { zh: "情绪投入较大，需自我照顾", en: "Higher emotional load; self-care matters" } },
  ],
  family: [
    { id: "take",    label: { zh: "增加承担",   en: "Take on more" }, deltas: { family: +3, career: -1, health: -2 }, reversibility: "medium", resourceCost: "high", pressure: "medium", cycleFit: "aligned", note: { zh: "关系收益明显，注意恢复", en: "Clear relational payoff; watch recovery" } },
    { id: "renegotiate", label: { zh: "重新协商边界", en: "Renegotiate boundaries" }, deltas: { family: +1, health: +2, social: +1 }, reversibility: "high", resourceCost: "low", pressure: "medium", cycleFit: "aligned", note: { zh: "先谈规则，避免长期消耗", en: "Set the rules first; avoid long-term drain" } },
    { id: "space",   label: { zh: "保留个人空间", en: "Preserve personal space" }, deltas: { family: -1, health: +2, study: +1 }, reversibility: "high", resourceCost: "low", pressure: "low", cycleFit: "neutral", note: { zh: "换恢复与学习空间", en: "Trades for recovery and learning space" } },
  ],
  wealth: [
    { id: "cash",    label: { zh: "保持流动性", en: "Keep liquidity" }, deltas: { wealthRisk: -2, family: +2 }, reversibility: "high", resourceCost: "low", pressure: "low", cycleFit: "aligned", note: { zh: "牺牲上行，换缓冲", en: "Trades upside for buffer" } },
    { id: "steady",  label: { zh: "稳健配置",   en: "Steady allocation" }, deltas: { wealthRisk: +1, family: +1 }, reversibility: "medium", resourceCost: "medium", pressure: "medium", cycleFit: "neutral", note: { zh: "以稳定为主，不做集中押注", en: "Stability first; no concentrated bets" } },
    { id: "risky",   label: { zh: "提高风险暴露", en: "Raise risk exposure" }, deltas: { wealthRisk: +4, family: -3, health: -1 }, reversibility: "low", resourceCost: "high", pressure: "high", cycleFit: "against", note: { zh: "仅做压力测试，不构成投资建议", en: "Stress-test only; not investment advice" } },
  ],
};

/**
 * Deterministic scenario branches for the Choice Lab.
 * Purely a rule expansion — no forecast is implied and no AI is called.
 */
export function scenarioBranches(
  age: number,
  choice: ScenarioChoiceKind,
  yearsAhead = 5,
): ScenarioBranch[] {
  const raw = CHOICE_LIBRARY[choice] ?? [];
  return raw.map((b) => {
    const perYearDeltas: Array<Partial<Record<DomainKey, number>>> = [];
    for (let y = 1; y <= yearsAhead; y += 1) {
      const partial: Partial<Record<DomainKey, number>> = {};
      for (const key of Object.keys(b.deltas) as DomainKey[]) {
        const v = b.deltas[key] ?? 0;
        // Effects decay slightly over 5 years to signal uncertainty.
        partial[key] = Number((v * (1 - (y - 1) * 0.08)).toFixed(2));
      }
      perYearDeltas.push(partial);
    }
    const { deltas: _drop, ...rest } = b;
    void _drop;
    return { ...rest, perYearDeltas };
  });
}

/* ------------------------------------------------------------------ */
/* Convenience — verify all evidence refs actually resolve.             */
/* ------------------------------------------------------------------ */

export function allRefsResolve(snapshot: AgeSnapshot): boolean {
  const refs = new Set<string>();
  for (const k of DOMAIN_KEYS) {
    for (const r of snapshot.domains[k].evidenceRefs) refs.add(r);
    for (const s of [...snapshot.domains[k].positiveSignals, ...snapshot.domains[k].frictionSignals]) {
      for (const r of s.evidenceRefs) refs.add(r);
    }
  }
  for (const ref of refs) {
    const res = resolveEvidence(ref, snapshot.facts);
    if (!res.ok) return false;
  }
  return true;
}
