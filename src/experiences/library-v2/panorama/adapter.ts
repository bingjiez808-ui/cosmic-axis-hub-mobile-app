/**
 * V1 integration adapter (interface + V2 stub).
 *
 * Contract: at real-app integration time, this file maps `PremiumFacts`
 * (from `src/lib/premium-facts.ts`) into `PanoramaFactsInput` — the
 * structural view the scoring engine consumes. The V2 Demo does NOT call
 * this adapter; it uses `DEMO_PANORAMA_FACTS` directly.
 *
 * Keeping the seam here means future V1 code can:
 *   1. Import `buildPanoramaFactsFromPremium` and pass a real PremiumFacts row.
 *   2. Feed the result into `computeDomainScores`.
 *   3. Cache the result under `v2_domain_scores_v1` (pending migration).
 *
 * The Demo cannot import `src/lib/premium-facts.ts` because that pulls
 * heavy calc modules; we accept a `PremiumFactsLike` structural type so
 * the adapter is portable and testable.
 */
import type { PanoramaFactsInput } from "./domain-score";

/**
 * Structural subset of PremiumFacts that this adapter reads. Keep this
 * conservative — new PremiumFacts fields require an explicit contract
 * bump.
 */
export interface PremiumFactsLike {
  chart_id: string;
  version: string;
  bazi?: {
    pillars?: { day?: { stem?: string } };
    ten_gods_summary?: PanoramaFactsInput["bazi"] extends infer T
      ? T extends { ten_gods_summary?: infer U }
        ? U
        : never
      : never;
    element_counts?: PanoramaFactsInput["bazi"] extends infer T
      ? T extends { element_counts?: infer U }
        ? U
        : never
      : never;
    luck?: { pillars?: { years?: [number, number] }[] };
  };
  ziwei?: {
    palaces?: { name: string; stars?: { name: string }[] }[];
    horoscope?: { daxian?: { label?: string } };
  };
  vedic?: {
    moon?: { nakshatra?: string };
    mahadasha?: { lord: string; from: string; to: string; antardasha?: { lord: string; from: string; to: string }[] }[];
  };
  western?: {
    planets?: { name: string; sign?: string }[];
    aspects?: { a: string; b: string; kind: string; orb: number }[];
    ascendant?: unknown;
    houses?: unknown;
    progressions?: unknown;
  };
  /** Precomputed hash of the PremiumFacts row; used as facts_hash. */
  facts_hash: string;
}

function findStars(pf: PremiumFactsLike, palaceName: string): string[] | undefined {
  const p = pf.ziwei?.palaces?.find((x) => x.name === palaceName);
  return p?.stars?.map((s) => s.name);
}

export function buildPanoramaFactsFromPremium(pf: PremiumFactsLike, now = Date.now()): PanoramaFactsInput {
  const dayStem = pf.bazi?.pillars?.day?.stem;
  const md = pf.vedic?.mahadasha?.[0];
  const ad = md?.antardasha?.[0];
  const western = pf.western
    ? {
        sun_sign: pf.western.planets?.find((p) => p.name === "Sun")?.sign,
        moon_sign: pf.western.planets?.find((p) => p.name === "Moon")?.sign,
        mercury_sign: pf.western.planets?.find((p) => p.name === "Mercury")?.sign,
        venus_sign: pf.western.planets?.find((p) => p.name === "Venus")?.sign,
        mars_sign: pf.western.planets?.find((p) => p.name === "Mars")?.sign,
        major_aspects: pf.western.aspects ?? [],
        ascendant_available: pf.western.ascendant != null,
        houses_available: pf.western.houses != null,
        progressions_available: pf.western.progressions != null,
      }
    : undefined;
  void now;
  return {
    chart_id: pf.chart_id,
    facts_hash: pf.facts_hash,
    bazi: pf.bazi
      ? {
          day_master: dayStem,
          ten_gods_summary: pf.bazi.ten_gods_summary,
          element_counts: pf.bazi.element_counts,
          current_dayun_label: pf.bazi.luck?.pillars?.[0]?.years
            ? `${pf.bazi.luck.pillars[0].years[0]}-${pf.bazi.luck.pillars[0].years[1]}`
            : undefined,
        }
      : undefined,
    ziwei: pf.ziwei
      ? {
          ming_palace_stars: findStars(pf, "命宫"),
          career_palace_stars: findStars(pf, "官禄"),
          spouse_palace_stars: findStars(pf, "夫妻"),
          wealth_palace_stars: findStars(pf, "财帛"),
          parent_palace_stars: findStars(pf, "父母"),
          current_daxian_label: pf.ziwei.horoscope?.daxian?.label,
        }
      : undefined,
    vedic:
      md != null
        ? {
            moon_nakshatra: pf.vedic?.moon?.nakshatra,
            mahadasha_current: { lord: md.lord, from: md.from, to: md.to },
            antardasha_current: ad ? { lord: ad.lord, from: ad.from, to: ad.to } : undefined,
            mercury_strong: undefined,
            venus_strong: undefined,
            jupiter_strong: undefined,
          }
        : undefined,
    western,
  };
}
