/**
 * daily-domain-score-v2 — deterministic per-day domain signals.
 *
 * v2 upgrade (2026-07): expanded from 4 → 5 non-overall life domains to
 * match the "Six Reading Rooms" of the Today's Reading Room UI:
 *
 *   overall (总体 · 节奏与主任务)
 *   love     (爱情 · 沟通与边界)
 *   study    (学业 · 注意力/理解/复习)
 *   career   (事业 · 协作/推进/决策)
 *   body_mind(身心 · 作息与压力；不诊断)
 *   finance  (财务 · 预算复核；不承诺收益)
 *
 * Migration notes:
 *   - v1 used `wealth`; v2 renames to `finance` to force stale caches to
 *     miss (any consumer keyed on score_version will re-derive).
 *   - v2 adds `body_mind`. No AI involvement.
 *   - Same input → same output. No Math.random.
 *
 * Consumes:
 *   - immutable natal FACTS (western planets we already trust)
 *   - `daily-facts-v1` output (transit planets + transit→natal aspects)
 *   - slower-cycle background summaries (Vedic Dasha, BaZi 大运+流年,
 *     Ziwei 大限+流年+流月) — passed in as opaque short strings; this
 *     module treats them as background context only, never fabricating
 *     per-day 干支 / Nakshatra / 流日 / 流时.
 */
import type { DailyFacts, DailyTransitAspect } from "./daily-facts";
import type { WesternBodyKey } from "./western-natal";

export const DAILY_DOMAIN_SCORE_VERSION = "daily-domain-score-v2";

export type DomainKey = "study" | "career" | "love" | "body_mind" | "finance";

export const DOMAIN_ORDER: readonly DomainKey[] = [
  "love",
  "study",
  "career",
  "body_mind",
  "finance",
] as const;

export type SignalBand = "supportive" | "neutral" | "mixed" | "caution";

/**
 * A single auditable contribution to a domain score. Every field is
 * derived deterministically from the DailyFacts aspect table; the UI
 * "score ledger" is generated from this array — never from hardcoded
 * demo data. `delta_applied` is the value actually added to the domain
 * score at the *score-scale* (i.e. after the ×2 in the final formula).
 */
export type DomainScoreContribution = {
  transit: WesternBodyKey;
  natal: WesternBodyKey;
  kind: "conjunction" | "opposition" | "trine" | "square" | "sextile";
  direction: 1 | -1;      // supportive (+1) or straining (-1)
  weight: number;         // 1..3
  orb: number;            // degrees, from facts
  orb_factor: number;     // max(0.2, 1 - orb/6)
  delta_raw: number;      // direction * weight * orb_factor
  delta_applied: number;  // rounded score-points, after ×2 in the aggregate
  evidence_ref: string;   // e.g. "daily.transit_to_natal_aspects[venus→sun,trine]"
};

export type DomainSignal = {
  domain: DomainKey;
  score: number;         // 0..100
  band: SignalBand;
  confidence: "low" | "medium" | "high";
  evidence_refs: string[];
  breakdown: DomainScoreContribution[]; // audit ledger — may be []
};

export type DailyDomainScore = {
  score_version: typeof DAILY_DOMAIN_SCORE_VERSION;
  partial: boolean;
  missing_facts: string[];
  overall: {
    score: number;
    band: SignalBand;
    theme_keywords: string[];
  };
  domains: DomainSignal[];
  supportive_signals: string[];
  caution_signals: string[];
  contradictions: string[];
  slower_cycle_context: {
    vedic?: string;
    bazi?: string;
    ziwei?: string;
  };
};

/**
 * Domain weights per transit body. Deliberately conservative — inner
 * planets (Sun/Moon/Mercury/Venus/Mars) affect study/love/comms scores;
 * outer bodies (Jupiter/Saturn/Uranus/Neptune) affect career/finance and
 * structural themes.
 *
 *   body_mind — Moon + Sun weighted (physiology & vitality),
 *     Saturn/Neptune drain when hard-aspected.
 *   finance   — Jupiter + Venus + Saturn (opportunity/value/discipline).
 */
const DOMAIN_WEIGHTS: Record<DomainKey, Partial<Record<WesternBodyKey, number>>> = {
  study:     { mercury: 3, sun: 2, moon: 1, jupiter: 2, saturn: 2 },
  career:    { sun: 3, saturn: 3, jupiter: 3, mars: 2, mercury: 1 },
  love:      { venus: 3, moon: 2, mars: 2, jupiter: 1, neptune: 1 },
  body_mind: { moon: 3, sun: 2, saturn: 2, mars: 1, neptune: 1 },
  finance:   { jupiter: 3, venus: 2, saturn: 2, sun: 1, mercury: 1 },
};

const NATAL_TARGETS: Record<DomainKey, WesternBodyKey[]> = {
  study:     ["sun", "moon", "mercury"],
  career:    ["sun", "saturn", "mars"],
  love:      ["sun", "moon", "venus"],
  body_mind: ["sun", "moon"],
  finance:   ["sun", "venus", "jupiter"],
};

function aspectSign(kind: DailyTransitAspect["kind"], transit: WesternBodyKey): number {
  switch (kind) {
    case "trine":
    case "sextile":
      return +1;
    case "square":
    case "opposition":
      return -1;
    case "conjunction":
      if (transit === "jupiter" || transit === "venus") return +0.5;
      if (transit === "saturn") return -0.5;
      return 0;
  }
}

function toBand(score: number): SignalBand {
  if (score >= 62) return "supportive";
  if (score >= 52) return "neutral";
  if (score >= 45) return "mixed";
  return "caution";
}

export function computeDailyDomainScore(input: {
  facts: DailyFacts | null;
  slower?: DailyDomainScore["slower_cycle_context"];
  natalHasTime: boolean;
}): DailyDomainScore {
  const missing: string[] = [];
  if (!input.facts) missing.push("daily_facts_v1");
  if (!input.natalHasTime) missing.push("natal_ascendant_and_houses");

  if (!input.facts) {
    return {
      score_version: DAILY_DOMAIN_SCORE_VERSION,
      partial: true,
      missing_facts: missing,
      overall: { score: 50, band: "neutral", theme_keywords: [] },
      domains: DOMAIN_ORDER.map((d) => ({
        domain: d, score: 50, band: "neutral", confidence: "low", evidence_refs: [],
      })),
      supportive_signals: [],
      caution_signals: [],
      contradictions: [],
      slower_cycle_context: input.slower ?? {},
    };
  }

  const facts = input.facts;
  const supportive: string[] = [];
  const caution: string[] = [];

  const domains: DomainSignal[] = DOMAIN_ORDER.map((d) => {
    let delta = 0;
    const refs: string[] = [];
    const targets = new Set(NATAL_TARGETS[d]);
    for (const a of facts.transit_to_natal_aspects) {
      if (!targets.has(a.natal)) continue;
      const w = DOMAIN_WEIGHTS[d][a.transit];
      if (!w) continue;
      const sign = aspectSign(a.kind, a.transit);
      if (sign === 0) continue;
      const orbFactor = 1 - a.orb / 6;
      const contribution = sign * w * Math.max(0.2, orbFactor);
      delta += contribution;
      refs.push(`daily.transit_to_natal_aspects[${a.transit}→${a.natal},${a.kind}]`);
      const label = `${a.transit}→${a.natal} ${a.kind}`;
      if (contribution > 0.5) supportive.push(`${d}:${label}`);
      if (contribution < -0.5) caution.push(`${d}:${label}`);
    }
    const score = Math.max(0, Math.min(100, Math.round(50 + delta * 2)));
    return {
      domain: d,
      score,
      band: toBand(score),
      confidence: input.natalHasTime ? "medium" : "low",
      evidence_refs: refs.slice(0, 6),
    };
  });

  const scores = domains.map((d) => d.score);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const extreme = scores.reduce((acc, v) => (Math.abs(v - 50) > Math.abs(acc - 50) ? v : acc), 50);
  const overallScore = Math.round(mean * 0.6 + extreme * 0.4);
  const contradictions: string[] = [];
  const maxS = Math.max(...scores);
  const minS = Math.min(...scores);
  if (maxS - minS >= 20) {
    const top = domains.find((d) => d.score === maxS)!;
    const bot = domains.find((d) => d.score === minS)!;
    contradictions.push(`${top.domain}(${top.score}) 与 ${bot.domain}(${bot.score}) 分数差 ≥ 20，请以现实情境为准。`);
  }

  const theme: string[] = [];
  if (facts.moon.phase === "new_moon") theme.push("new_moon:起始");
  if (facts.moon.phase === "full_moon") theme.push("full_moon:显化");
  const retroInner = facts.transit_planets.filter((p) => p.retro && (p.key === "mercury" || p.key === "venus" || p.key === "mars"));
  if (retroInner.length) theme.push(`retrograde:${retroInner.map((p) => p.key).join(",")}`);

  return {
    score_version: DAILY_DOMAIN_SCORE_VERSION,
    partial: false,
    missing_facts: missing,
    overall: { score: overallScore, band: toBand(overallScore), theme_keywords: theme },
    domains,
    supportive_signals: supportive.slice(0, 8),
    caution_signals: caution.slice(0, 8),
    contradictions,
    slower_cycle_context: input.slower ?? {},
  };
}
