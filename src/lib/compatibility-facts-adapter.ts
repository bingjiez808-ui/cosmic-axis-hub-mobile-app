/**
 * compatibility-facts-adapter-v1
 *
 * Derives the four scalar facets consumed by `compatibility-score-v1`
 * (`yang`, `pace`, `openness`, `rootedness`) from a person's already-
 * computed birth-chart FACTS. Every scalar it emits carries at least
 * one `evidence_ref` that points into `PremiumFacts` — the same
 * evidence-path notation used by the premium report — plus a list of
 * `missing_facts` when a source system was not derivable.
 *
 * Intentional non-goals:
 *   • We do NOT invent traditional compatibility rules (Synastry
 *     composites, 合冲刑害 tables, Ashtakoot Guna, etc.). If a system
 *     has no textbook facet rule that we can honestly wire, we return
 *     `null` for that system's contribution and record a
 *     `missing_facts` entry. Callers must treat any scalar with fewer
 *     than 2 supporting systems as `single_system` / lowered
 *     confidence.
 *   • We do NOT return "relationship success" scores. This module
 *     produces only the four side facets; scoring dimensions live in
 *     `compatibility-score.ts`.
 */
import type { PremiumFacts } from "./premium-facts";

export const COMPATIBILITY_FACTS_ADAPTER_VERSION =
  "compatibility-facts-adapter-v1" as const;

export type FacetValue = {
  value: number;
  evidence_refs: string[];
  systems: Array<"bazi" | "ziwei" | "western" | "vedic">;
};

export type AdaptedFacets = {
  yang: FacetValue | null;
  pace: FacetValue | null;
  openness: FacetValue | null;
  rootedness: FacetValue | null;
  missing_facts: string[];
  /** Cross-system consensus bodies per facet, for downstream evidence display. */
  consensus_bodies: string[];
  confidence: number; // 0..1, weighted by facet coverage
};

/* -------------------- helpers -------------------- */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const YIN_STEMS = new Set(["乙", "丁", "己", "辛", "癸"]);
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
/** Rough classical polarity of ziwei major stars (紫微/天府/太阳 阳；太阴 阴). */
const ZIWEI_YANG_STARS = new Set([
  "紫微", "天府", "太阳", "武曲", "天梁", "廉贞", "破军", "七杀",
]);
const ZIWEI_YIN_STARS = new Set([
  "太阴", "天同", "天机", "天相", "巨门", "贪狼", "文曲",
]);

/* -------------------- facets -------------------- */

/**
 * yang: day-master stem polarity (BaZi) + Sun sign element (Western fire/air = +).
 */
function facetYang(f: PremiumFacts): FacetValue | null {
  const parts: { v: number; ref: string; sys: FacetValue["systems"][number] }[] = [];
  const dm = f.bazi?.day_master?.stem;
  if (dm) {
    if (YANG_STEMS.has(dm)) parts.push({ v: 0.65, ref: "bazi.day_master", sys: "bazi" });
    else if (YIN_STEMS.has(dm)) parts.push({ v: -0.5, ref: "bazi.day_master", sys: "bazi" });
  }
  const sunEl = f.western?.sun.element;
  if (sunEl === "fire" || sunEl === "air") parts.push({ v: 0.55, ref: "western.sun", sys: "western" });
  else if (sunEl === "water" || sunEl === "earth") parts.push({ v: -0.4, ref: "western.sun", sys: "western" });

  // Ziwei命宫 major star polarity is a soft signal, weighted low.
  const soulName = f.ziwei?.soul;
  if (soulName) {
    if (ZIWEI_YANG_STARS.has(soulName)) parts.push({ v: 0.35, ref: "ziwei.soul", sys: "ziwei" });
    else if (ZIWEI_YIN_STARS.has(soulName)) parts.push({ v: -0.3, ref: "ziwei.soul", sys: "ziwei" });
  }

  if (parts.length === 0) return null;
  const value = clamp(parts.reduce((s, p) => s + p.v, 0) / parts.length, -1, 1);
  return {
    value,
    evidence_refs: parts.map((p) => p.ref),
    systems: [...new Set(parts.map((p) => p.sys))],
  };
}

/**
 * pace: BaZi 十神 initiating vs receiving balance (七杀/正官/伤官 vs 印/食神),
 * plus Western Mercury sign element (fire/air → faster).
 */
function facetPace(f: PremiumFacts): FacetValue | null {
  const parts: { v: number; ref: string; sys: FacetValue["systems"][number] }[] = [];
  if (f.bazi?.ten_gods && f.bazi.ten_gods.length > 0) {
    const initiating = new Set(["七杀", "正官", "伤官", "劫财", "偏财"]);
    const receiving = new Set(["正印", "偏印", "食神", "比肩"]);
    let init = 0, recv = 0;
    for (const g of f.bazi.ten_gods) {
      if (!g.label) continue;
      if (initiating.has(g.label)) init += 1;
      else if (receiving.has(g.label)) recv += 1;
    }
    const total = init + recv;
    if (total > 0) parts.push({ v: init / total, ref: "bazi.ten_gods", sys: "bazi" });
  }
  const mercury = f.western?.planets.find((p) => p.name === "Mercury");
  if (mercury) {
    const fastSigns = new Set(["Aries", "Gemini", "Leo", "Libra", "Sagittarius", "Aquarius"]);
    parts.push({
      v: fastSigns.has(mercury.sign_en) ? 0.7 : 0.35,
      ref: "western.planets",
      sys: "western",
    });
  }
  if (parts.length === 0) return null;
  const value = clamp(parts.reduce((s, p) => s + p.v, 0) / parts.length, 0, 1);
  return {
    value,
    evidence_refs: parts.map((p) => p.ref),
    systems: [...new Set(parts.map((p) => p.sys))],
  };
}

/**
 * openness: BaZi 食伤 presence + Western major-aspect count involving Moon/Venus/Mercury.
 * A high aspect count on communicative bodies → more expressive tendency.
 */
function facetOpenness(f: PremiumFacts): FacetValue | null {
  const parts: { v: number; ref: string; sys: FacetValue["systems"][number] }[] = [];
  if (f.bazi?.ten_gods) {
    const expressive = f.bazi.ten_gods.filter((g) => g.label === "食神" || g.label === "伤官").length;
    parts.push({
      v: clamp(0.35 + expressive * 0.2, 0, 1),
      ref: "bazi.ten_gods",
      sys: "bazi",
    });
  }
  if (f.western?.aspects) {
    const commBodies = new Set(["Moon", "Venus", "Mercury"]);
    const n = f.western.aspects.filter((a) => commBodies.has(a.a) || commBodies.has(a.b)).length;
    parts.push({ v: clamp(0.25 + n * 0.08, 0, 1), ref: "western.aspects", sys: "western" });
  }
  if (parts.length === 0) return null;
  const value = clamp(parts.reduce((s, p) => s + p.v, 0) / parts.length, 0, 1);
  return {
    value,
    evidence_refs: parts.map((p) => p.ref),
    systems: [...new Set(parts.map((p) => p.sys))],
  };
}

/**
 * rootedness: BaZi earth+metal proportion + Western earth/water sun element.
 */
function facetRootedness(f: PremiumFacts): FacetValue | null {
  const parts: { v: number; ref: string; sys: FacetValue["systems"][number] }[] = [];
  const counts = f.bazi?.element_counts;
  if (counts) {
    const total = counts.wood + counts.fire + counts.earth + counts.metal + counts.water;
    if (total > 0) {
      const grounded = (counts.earth + counts.metal) / total;
      parts.push({ v: clamp(grounded, 0, 1), ref: "bazi.pillars.day", sys: "bazi" });
    }
  }
  const sunEl = f.western?.sun.element;
  if (sunEl === "earth" || sunEl === "water") parts.push({ v: 0.7, ref: "western.sun", sys: "western" });
  else if (sunEl === "fire" || sunEl === "air") parts.push({ v: 0.35, ref: "western.sun", sys: "western" });

  if (parts.length === 0) return null;
  const value = clamp(parts.reduce((s, p) => s + p.v, 0) / parts.length, 0, 1);
  return {
    value,
    evidence_refs: parts.map((p) => p.ref),
    systems: [...new Set(parts.map((p) => p.sys))],
  };
}

/* -------------------- main -------------------- */

export function adaptFacetsFromFacts(facts: PremiumFacts | null): AdaptedFacets {
  if (!facts) {
    return {
      yang: null, pace: null, openness: null, rootedness: null,
      missing_facts: ["premium_facts:null"],
      consensus_bodies: [],
      confidence: 0,
    };
  }
  const yang = facetYang(facts);
  const pace = facetPace(facts);
  const openness = facetOpenness(facts);
  const rootedness = facetRootedness(facts);

  const missing: string[] = [];
  if (!facts.bazi) missing.push("bazi:absent");
  if (!facts.ziwei) missing.push("ziwei:absent");
  if (!facts.western) missing.push("western:absent");
  if (!facts.vedic) missing.push("vedic:absent");
  if (!yang) missing.push("facet:yang");
  if (!pace) missing.push("facet:pace");
  if (!openness) missing.push("facet:openness");
  if (!rootedness) missing.push("facet:rootedness");

  const facets = [yang, pace, openness, rootedness].filter((v): v is FacetValue => !!v);
  const confidence = Math.round((facets.length / 4) * 100) / 100;

  const consensus = new Set<string>();
  for (const fv of facets) {
    for (const s of fv.systems) consensus.add(s);
  }

  return {
    yang, pace, openness, rootedness,
    missing_facts: missing,
    consensus_bodies: [...consensus],
    confidence,
  };
}

/**
 * Aggregate evidence_refs from both sides for downstream display.
 * If fewer than two source systems support a facet across BOTH sides,
 * the caller should tag that facet as `single_system` in its UI.
 */
export function aggregateEvidence(a: AdaptedFacets, b: AdaptedFacets): {
  refs: string[];
  cross_system_support: boolean;
} {
  const refs = new Set<string>();
  for (const f of [a.yang, a.pace, a.openness, a.rootedness, b.yang, b.pace, b.openness, b.rootedness]) {
    if (!f) continue;
    for (const r of f.evidence_refs) refs.add(r);
  }
  const systems = new Set<string>([...a.consensus_bodies, ...b.consensus_bodies]);
  return { refs: [...refs], cross_system_support: systems.size >= 2 };
}
