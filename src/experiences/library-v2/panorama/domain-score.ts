/**
 * Deterministic domain-score-v1 engine.
 *
 * Rules (Fate Nexus Reading contract):
 *   - Only deterministic FACTS produce scores. No AI, no random, no clock.
 *   - Same facts → identical output.
 *   - Unsupported systems (e.g. Western houses / progressions when not
 *     supplied) are marked available:false with reason codes and do NOT
 *     silently invent contribution.
 *   - Score is called a "signal" in UI — NEVER good/bad, success rate,
 *     or prediction.
 *
 * Input shape:
 *   The V2 Demo passes a `PanoramaFactsInput` — a minimal, typed subset
 *   of PremiumFacts. The V1 adapter in `adapter.ts` maps real
 *   PremiumFacts onto this shape at integration time.
 */

import type {
  DomainKey,
  DomainScoreResult,
  RecommendedFirstRead,
  SystemContribution,
  SystemKey,
} from "./types";
import { DOMAIN_ORDER, DOMAIN_LABEL } from "./types";

export const DOMAIN_SCORE_VERSION = "domain-score-v1" as const;

/* ------------------------------ input shape ------------------------------ */

/**
 * Minimal, structural view of the FACTS the scorer relies on. The V1
 * adapter fills these fields from PremiumFacts; missing fields are OK
 * and produce `available:false` contributions with reason codes.
 */
export interface PanoramaFactsInput {
  chart_id: string;
  facts_hash: string;
  bazi?: {
    day_master?: string; // e.g. "甲"
    day_element?: "wood" | "fire" | "earth" | "metal" | "water";
    ten_gods_summary?: Partial<Record<
      "比肩" | "劫财" | "食神" | "伤官" | "偏财" | "正财" | "七杀" | "正官" | "偏印" | "正印",
      number
    >>;
    element_counts?: Partial<Record<"wood" | "fire" | "earth" | "metal" | "water", number>>;
    current_dayun_label?: string; // "2015-2024"
  };
  ziwei?: {
    ming_palace_stars?: string[]; // main stars in 命宫
    career_palace_stars?: string[]; // 官禄
    spouse_palace_stars?: string[]; // 夫妻
    wealth_palace_stars?: string[]; // 财帛
    parent_palace_stars?: string[]; // 父母 (proxies study/mentor)
    current_daxian_label?: string;
  };
  vedic?: {
    moon_nakshatra?: string;
    mahadasha_current?: { lord: string; from: string; to: string };
    antardasha_current?: { lord: string; from: string; to: string };
    mercury_strong?: boolean;
    venus_strong?: boolean;
    jupiter_strong?: boolean;
  };
  western?: {
    sun_sign?: string;
    moon_sign?: string;
    mercury_sign?: string;
    venus_sign?: string;
    mars_sign?: string;
    major_aspects?: { a: string; b: string; kind: string; orb: number }[];
    ascendant_available?: boolean;
    houses_available?: boolean; // WHOLE-SIGN only ever
    progressions_available?: boolean; // usually false in V2
  };
}

/* ------------------------------ scoring core ----------------------------- */

/** FNV-1a for stable stringified hashes used inside content_hash. */
export function fnv1aHex(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface RawContribution {
  contribution: number;
  available: boolean;
  reason_codes: string[];
  evidence_refs: string[];
  timing: string[];
  missing: string[];
}

function empty(reason: string): RawContribution {
  return {
    contribution: 0,
    available: false,
    reason_codes: [reason],
    evidence_refs: [],
    timing: [],
    missing: [],
  };
}

/* ---- BaZi per-domain contributions ---- */

const TEN_GOD_DOMAIN_WEIGHT: Record<DomainKey, Partial<Record<string, number>>> = {
  study:  { 正印: 12, 偏印: 8,  食神: 6,  伤官: 4,  正官: 4 },
  career: { 正官: 12, 七杀: 8,  食神: 6,  伤官: 6,  正财: 4 },
  love:   { 正财: 8,  偏财: 6,  食神: 4,  伤官: 4,  正官: 6 },
  wealth: { 正财: 12, 偏财: 10, 食神: 4,  伤官: 2,  正官: 2 },
};

function baziContribution(f: PanoramaFactsInput, d: DomainKey): RawContribution {
  const bz = f.bazi;
  if (!bz || !bz.ten_gods_summary || !bz.day_master) {
    return {
      contribution: 0,
      available: false,
      reason_codes: ["bazi.ten_gods_summary_missing"],
      evidence_refs: [],
      timing: [],
      missing: ["bazi.ten_gods_summary", "bazi.day_master"],
    };
  }
  const weights = TEN_GOD_DOMAIN_WEIGHT[d];
  let sum = 0;
  const evidence: string[] = ["bazi.day_master", "bazi.ten_gods_summary"];
  for (const [tg, w] of Object.entries(weights)) {
    const count = bz.ten_gods_summary[tg as keyof typeof bz.ten_gods_summary] ?? 0;
    sum += count * (w as number);
  }
  const contribution = clamp(sum / 4 - 10, -30, 30); // normalize
  const timing = bz.current_dayun_label
    ? [`bazi.dayun[${bz.current_dayun_label}]`]
    : [];
  return {
    contribution,
    available: true,
    reason_codes: contribution > 8 ? ["bazi_ten_gods_favor_domain"] : contribution < -4 ? ["bazi_ten_gods_absent_for_domain"] : ["bazi_ten_gods_neutral"],
    evidence_refs: evidence,
    timing,
    missing: [],
  };
}

/* ---- Ziwei per-domain contributions ---- */

const STAR_STRENGTH_BUMP = 6;

function ziweiContribution(f: PanoramaFactsInput, d: DomainKey): RawContribution {
  const zw = f.ziwei;
  if (!zw) return empty("ziwei_missing");
  const palaceMap: Record<DomainKey, keyof typeof zw> = {
    study: "parent_palace_stars",
    career: "career_palace_stars",
    love: "spouse_palace_stars",
    wealth: "wealth_palace_stars",
  };
  const key = palaceMap[d];
  const stars = zw[key] as string[] | undefined;
  const ming = zw.ming_palace_stars ?? [];
  const evidence = [`ziwei.${String(key)}`, "ziwei.ming_palace"];
  if (!stars || stars.length === 0) {
    return {
      contribution: 0,
      available: false,
      reason_codes: [`ziwei_${String(key)}_empty`],
      evidence_refs: evidence,
      timing: [],
      missing: [`ziwei.${String(key)}`],
    };
  }
  const majorStarCount = stars.filter((s) =>
    ["紫微", "天府", "武曲", "太阳", "太阴", "廉贞", "天同", "天梁", "天机", "巨门", "破军", "七杀", "贪狼", "天相"].includes(s),
  ).length;
  const contribution = clamp(majorStarCount * STAR_STRENGTH_BUMP + (ming.length ? 3 : 0) - 6, -20, 24);
  const timing = zw.current_daxian_label ? [`ziwei.daxian[${zw.current_daxian_label}]`] : [];
  return {
    contribution,
    available: true,
    reason_codes: contribution > 6 ? ["ziwei_palace_strong"] : ["ziwei_palace_moderate"],
    evidence_refs: evidence,
    timing,
    missing: [],
  };
}

/* ---- Vedic per-domain contributions ---- */

function vedicContribution(f: PanoramaFactsInput, d: DomainKey): RawContribution {
  const v = f.vedic;
  if (!v || !v.mahadasha_current) return empty("vedic_mahadasha_missing");
  const evidence = ["vedic.mahadasha[0]"];
  if (v.moon_nakshatra) evidence.push("vedic.moon_nakshatra");
  const lord = v.mahadasha_current.lord;
  const domainLordBias: Record<DomainKey, string[]> = {
    study: ["Mercury", "Jupiter"],
    career: ["Sun", "Saturn", "Mars"],
    love: ["Venus", "Moon"],
    wealth: ["Jupiter", "Venus"],
  };
  const strongMap: Record<DomainKey, boolean | undefined> = {
    study: v.mercury_strong,
    career: v.jupiter_strong,
    love: v.venus_strong,
    wealth: v.jupiter_strong,
  };
  let contribution = 0;
  const codes: string[] = [];
  if (domainLordBias[d].includes(lord)) {
    contribution += 10;
    codes.push(`vedic_mahadasha_lord_favors_${d}`);
  } else {
    codes.push(`vedic_mahadasha_lord_neutral_${d}`);
  }
  if (strongMap[d]) {
    contribution += 6;
    codes.push(`vedic_karaka_strong_${d}`);
  }
  const timing = [`vedic.mahadasha[${v.mahadasha_current.from}→${v.mahadasha_current.to}]`];
  return {
    contribution: clamp(contribution, -10, 20),
    available: true,
    reason_codes: codes,
    evidence_refs: evidence,
    timing,
    missing: [],
  };
}

/* ---- Western per-domain contributions ---- */

function westernContribution(f: PanoramaFactsInput, d: DomainKey): RawContribution {
  const w = f.western;
  if (!w) return empty("western_missing");
  // Houses and progressions may not be available; we don't invent them.
  const missing: string[] = [];
  if (!w.houses_available) missing.push("western.houses");
  if (!w.progressions_available) missing.push("western.progressions");
  const codes: string[] = [];
  const evidence: string[] = [];
  if (w.sun_sign) evidence.push("western.sun");
  if (w.moon_sign) evidence.push("western.moon");
  const key = { study: "mercury", career: "sun", love: "venus", wealth: "sun" }[d];
  const sign = { study: w.mercury_sign, career: w.sun_sign, love: w.venus_sign, wealth: w.sun_sign }[d];
  let contribution = 0;
  if (sign) {
    evidence.push(`western.${key}`);
    contribution += 4;
    codes.push(`western_${key}_available`);
  } else {
    missing.push(`western.${key}`);
  }
  // Major aspects: count harmonious/challenging touching the relevant planet.
  if (w.major_aspects && key) {
    const touching = w.major_aspects.filter((a) => a.a.toLowerCase() === key || a.b.toLowerCase() === key);
    for (const a of touching) {
      const kind = a.kind.toLowerCase();
      if (kind === "trine" || kind === "sextile") contribution += 3;
      else if (kind === "square" || kind === "opposition") contribution -= 2;
      else if (kind === "conjunction") contribution += 1;
    }
    if (touching.length > 0) evidence.push(`western.aspects[${key}]`);
  }
  return {
    contribution: clamp(contribution, -12, 18),
    available: true,
    reason_codes: codes.length ? codes : ["western_baseline_only"],
    evidence_refs: evidence,
    timing: [],
    missing,
  };
}

/* ------------------------------ aggregation ------------------------------ */

function bandFor(score: number, availableCount: number): DomainScoreResult["band"] {
  if (availableCount < 2) return "insufficient_facts";
  if (score >= 65) return "high_signal";
  return "mid_signal";
}

function confidenceFor(availableCount: number, missingCount: number): DomainScoreResult["confidence"] {
  if (availableCount >= 4 && missingCount === 0) return "high";
  if (availableCount >= 3) return "mid";
  if (availableCount >= 2) return "low";
  return "reference_only";
}

function contradictionFlags(contributions: SystemContribution[]): string[] {
  const flags: string[] = [];
  const available = contributions.filter((c) => c.available);
  if (available.length < 2) return flags;
  const signs = available.map((c) => Math.sign(c.contribution));
  const hasPositive = signs.some((s) => s > 0);
  const hasNegative = signs.some((s) => s < 0);
  if (hasPositive && hasNegative) {
    const pos = available.filter((c) => c.contribution > 0).map((c) => c.system);
    const neg = available.filter((c) => c.contribution < 0).map((c) => c.system);
    flags.push(`systems_disagree:+${pos.join(",")}/-${neg.join(",")}`);
  }
  return flags;
}

function scoreForDomain(f: PanoramaFactsInput, d: DomainKey, now: number): DomainScoreResult {
  const raw: Record<SystemKey, RawContribution> = {
    bazi: baziContribution(f, d),
    ziwei: ziweiContribution(f, d),
    vedic: vedicContribution(f, d),
    western: westernContribution(f, d),
  };
  const systems: SystemContribution[] = (Object.keys(raw) as SystemKey[]).map((s) => ({
    system: s,
    contribution: Math.round(raw[s].contribution * 10) / 10,
    available: raw[s].available,
    reason_codes: raw[s].reason_codes,
  }));
  const totalContribution = systems.reduce((sum, s) => sum + s.contribution, 0);
  const score = clamp(Math.round(50 + totalContribution), 0, 100);
  const availableCount = systems.filter((s) => s.available).length;
  const evidenceRefs = Array.from(
    new Set((Object.keys(raw) as SystemKey[]).flatMap((s) => raw[s].evidence_refs)),
  );
  const timing = Array.from(
    new Set((Object.keys(raw) as SystemKey[]).flatMap((s) => raw[s].timing)),
  );
  const missing = Array.from(
    new Set((Object.keys(raw) as SystemKey[]).flatMap((s) => raw[s].missing)),
  );
  return {
    domain: d,
    score,
    band: bandFor(score, availableCount),
    confidence: confidenceFor(availableCount, missing.length),
    evidence_refs: evidenceRefs,
    system_contributions: systems,
    timing_activation: timing,
    contradiction_flags: contradictionFlags(systems),
    missing_facts: missing,
    calculation_version: DOMAIN_SCORE_VERSION,
    calculated_at: now,
  };
}

/** Deterministic entry point. `now` defaults to a fixed epoch so tests
 *  are stable; callers may pass Date.now() in production. */
export function computeDomainScores(
  f: PanoramaFactsInput,
  now = 0,
): DomainScoreResult[] {
  return DOMAIN_ORDER.map((d) => scoreForDomain(f, d, now));
}

/* ---------------------------- recommendation ---------------------------- */

/**
 * Recommend the domain the reader should start with.
 * Not simply "highest score" — combines:
 *   - signal strength (score)
 *   - extremity (|score-50|)
 *   - timing activation (+bonus)
 *   - evidence completeness (available systems)
 *   - user preview weight (light nudge, never overrides high-signal)
 */
export function recommendFirstRead(
  scores: DomainScoreResult[],
  previewCounts: Partial<Record<DomainKey, number>> = {},
): RecommendedFirstRead {
  const ranked = scores.map((s) => {
    const extremity = Math.abs(s.score - 50);
    const timingBonus = s.timing_activation.length > 0 ? 6 : 0;
    const evidenceBonus = s.system_contributions.filter((c) => c.available).length * 2;
    const previewBonus = Math.min(4, (previewCounts[s.domain] ?? 0) * 2);
    const penalty = s.band === "insufficient_facts" ? 30 : 0;
    return {
      s,
      rank: s.score * 0.6 + extremity * 0.8 + timingBonus + evidenceBonus + previewBonus - penalty,
    };
  });
  ranked.sort((a, b) => b.rank - a.rank);
  const top = ranked[0].s;
  const reason_codes: string[] = [];
  if (top.band === "high_signal") reason_codes.push("high_cross_system_signal");
  if (top.timing_activation.length > 0) reason_codes.push("current_cycle_activation");
  if (top.system_contributions.filter((c) => c.available).length >= 3) {
    reason_codes.push("evidence_coverage_good");
  }
  if ((previewCounts[top.domain] ?? 0) > 0) reason_codes.push("map_preview_interest");
  if (reason_codes.length === 0) reason_codes.push("balanced_recommendation");

  const label = DOMAIN_LABEL[top.domain];
  const reason_text =
    top.band === "high_signal"
      ? `这一领域的跨体系信号更集中${top.timing_activation.length ? "，并且当前周期出现了可观察的变化" : ""}。`
      : `这一领域目前的证据最完整，先读它有助于你后续判断其他章节。`;
  return {
    domain: top.domain,
    reason_codes,
    reason_text: `猜你可能想先读：${label}。${reason_text}`,
    disclaimer: "这是阅读顺序推荐，不是命运结论。",
  };
}
