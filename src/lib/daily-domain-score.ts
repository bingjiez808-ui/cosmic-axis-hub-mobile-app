/**
 * daily-domain-score-v1 — deterministic per-day domain signals.
 *
 * Consumes:
 *   - immutable natal FACTS (western planets we already trust)
 *   - `daily-facts-v1` output (transit planets + transit→natal aspects)
 *   - slower-cycle background summaries (Vedic Dasha, BaZi 大运+流年,
 *     Ziwei 大限+流年+流月) — passed in as opaque short strings; this
 *     module treats them as background context only, never fabricating
 *     per-day 干支 / Nakshatra / 流日 / 流时.
 *
 * Produces overall + 4 domain "signals" (study / career / love / wealth)
 * clamped to [0,100], centred at 50, plus band, confidence,
 * supportive_signals, caution_signals, contradictions, missing_facts.
 *
 * Rules encoded (see references/output-schema.md):
 *   - AI never touches this file.
 *   - No Math.random. Same input → same output.
 *   - When daily facts are absent (e.g. natal missing), returns a
 *     `partial: true` object; UI must NOT display fabricated scores.
 *   - Overall is NOT a plain average — it weighs the highest-magnitude
 *     signal band so a strong caution isn't hidden by domain averaging.
 */
import type { DailyFacts, DailyTransitAspect } from "./daily-facts";
import type { WesternBodyKey } from "./western-natal";

export const DAILY_DOMAIN_SCORE_VERSION = "daily-domain-score-v1";

export type DomainKey = "study" | "career" | "love" | "wealth";

export type SignalBand = "supportive" | "neutral" | "mixed" | "caution";

export type DomainSignal = {
  domain: DomainKey;
  score: number;         // 0..100
  band: SignalBand;
  confidence: "low" | "medium" | "high";
  evidence_refs: string[];
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
 * outer bodies (Jupiter/Saturn/Uranus/Neptune) affect career/wealth and
 * structural themes. Weights are the *magnitude* the aspect contributes;
 * sign comes from aspect kind.
 */
const DOMAIN_WEIGHTS: Record<DomainKey, Partial<Record<WesternBodyKey, number>>> = {
  study:  { mercury: 3, sun: 2, moon: 1, jupiter: 2, saturn: 2 },
  career: { sun: 3, saturn: 3, jupiter: 3, mars: 2, mercury: 1 },
  love:   { venus: 3, moon: 2, mars: 2, jupiter: 1, neptune: 1 },
  wealth: { jupiter: 3, venus: 2, saturn: 2, sun: 1, mercury: 1 },
};

const NATAL_TARGETS: Record<DomainKey, WesternBodyKey[]> = {
  study:  ["sun", "moon", "mercury"],
  career: ["sun", "saturn", "mars"],
  love:   ["sun", "moon", "venus"],
  wealth: ["sun", "venus", "jupiter"],
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
      // Conjunction is ambiguous; heuristics: Jupiter/Venus positive,
      // Saturn negative, Sun/Moon/Mercury/Mars neutral (magnitude 0.5).
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
      domains: (["study", "career", "love", "wealth"] as DomainKey[]).map((d) => ({
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

  const domains: DomainSignal[] = (["study", "career", "love", "wealth"] as DomainKey[]).map((d) => {
    let delta = 0;
    const refs: string[] = [];
    const targets = new Set(NATAL_TARGETS[d]);
    for (const a of facts.transit_to_natal_aspects) {
      if (!targets.has(a.natal)) continue;
      const w = DOMAIN_WEIGHTS[d][a.transit];
      if (!w) continue;
      const sign = aspectSign(a.kind, a.transit);
      if (sign === 0) continue;
      const orbFactor = 1 - a.orb / 6; // tighter orb → more weight
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

  // Overall = weighted mean pulled toward the extreme domain so a single
  // strong caution isn't averaged away.
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
