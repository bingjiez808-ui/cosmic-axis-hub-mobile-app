// @ts-expect-error bun:test
import { describe, it, expect } from "bun:test";
import type { PremiumFacts } from "./premium-facts";
import {
  FACTS_VERSION,
  YEAR_READING_CALC_VERSION,
  YEAR_READING_SKILL_VERSION,
  hashFactsForYearReading,
  readYear,
  readYearWindow,
  validateYearReading,
} from "./year-readings";

/**
 * Regression coverage for the deterministic year-reading self-heal path:
 *
 *   1. FACTS_VERSION exists and is exported.
 *   2. When ANY facts subset changes, `hashFactsForYearReading` shifts —
 *      guaranteeing stale rows keyed by the old hash are ignored by the
 *      cache filter in `ensureYearReadings`.
 *   3. With a full four-system fixture (BaZi + Ziwei + Vedic + Western),
 *      every system reports `available: true` and the composite has a
 *      real score with confidence ≥ mid.
 */

const BAZI_FULL = {
  pillars: { year: "壬午", month: "庚戌", day: "己巳", hour: "甲子" },
  day_master: { stem: "己", element: "earth" as const },
  ten_gods: [],
  element_counts: { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 },
  zodiac: { zh: "马", en: "Horse" },
  luck: {
    source: "lunar-javascript",
    gender: "female" as const,
    forward_order: false,
    start: {
      solar_date: "2003-01-01", year: 2003, month: 1, day: 1,
      offset_years: 0, offset_months: 0, offset_days: 0, nominal_start_age: 0,
    },
    pre_luck: null,
    pillars: [
      {
        index: 0, gan_zhi: "己酉", start_year: 2003, end_year: 2012,
        start_age: 0, end_age: 9, xun: null, xun_kong: null,
        liu_nian: [
          { year: 2010, gan_zhi: "庚寅", nominal_age: 7 },
          { year: 2011, gan_zhi: "辛卯", nominal_age: 8 },
        ],
      },
      {
        index: 1, gan_zhi: "戊申", start_year: 2013, end_year: 2022,
        start_age: 10, end_age: 19, xun: null, xun_kong: null,
        liu_nian: [{ year: 2020, gan_zhi: "庚子", nominal_age: 17 }],
      },
    ],
  },
  evidence_paths: {
    year_pillar: "bazi.pillars.year",
    month_pillar: "bazi.pillars.month",
    day_pillar: "bazi.pillars.day",
    hour_pillar: "bazi.pillars.hour",
    day_master: "bazi.day_master",
    luck_pillars: "bazi.luck.pillars",
    luck_start: "bazi.luck.start",
  },
} as unknown as PremiumFacts["bazi"];

const VEDIC_FULL = {
  ascendant_sign: null,
  moon: { sign: 3, nakshatra_en: "Pushya", nakshatra_zh: "鬼宿", pada: 2 },
  vimshottari_current: null,
  vimshottari_next: null,
  mahadasha: [{
    lord: "Venus" as const, start: "2000-01-01T00:00:00Z", end: "2020-01-01T00:00:00Z",
    years: 20, antardasha: [
      { lord: "Venus" as const, start: "2000-01-01T00:00:00Z", end: "2003-01-01T00:00:00Z", years: 3, pratyantar: [] },
      { lord: "Sun" as const, start: "2003-01-01T00:00:00Z", end: "2004-01-01T00:00:00Z", years: 1, pratyantar: [] },
    ],
  }],
  current: null,
  pratyantar_available: false,
  evidence_paths: { moon: "vedic.moon", dasha: "vedic.mahadasha", current: "vedic.current" },
} as unknown as PremiumFacts["vedic"];

const ZIWEI_FULL = {
  soul: "紫微", body: "天府", five_elements_class: "水二局", lunar_date: "",
  soul_palace_index: 0, palaces: [], horoscope: null,
  horoscope_years: [{
    source: "iztro@2.5.8 horoscope()",
    as_of_date: "2010-11-03", solar_date: "2010-11-03", lunar_date: "",
    decadal: { index: 0, name: "命宫", heavenly_stem: "甲", earthly_branch: "子",
      palace_names: [], mutagen: [], age_range: [0, 9] as [number, number] },
    yearly: { index: 0, name: "2010年", heavenly_stem: "甲", earthly_branch: "子",
      palace_names: [], mutagen: ["禄"], sui_qian_12: [], jiang_qian_12: [] },
    monthly: { index: 0, name: "月宫", heavenly_stem: "甲", earthly_branch: "子",
      palace_names: [], mutagen: [] },
  }],
  evidence_paths: {
    soul_palace: "ziwei.palaces[0]" as const,
    five_elements_class: "ziwei.five_elements_class" as const,
    horoscope: "ziwei.horoscope" as const,
    horoscope_years: "ziwei.horoscope_years" as const,
  },
} as unknown as PremiumFacts["ziwei"];

const WESTERN_FULL = {
  ascendant: 100, ascendant_sign: "Cancer" as const, midheaven: null,
  planets: [
    { name: "Sun" as const, longitude: 220, sign: "Scorpio" as const, retrograde: false },
    { name: "Moon" as const, longitude: 50, sign: "Taurus" as const, retrograde: false },
    { name: "Jupiter" as const, longitude: 100, sign: "Cancer" as const, retrograde: false },
  ],
  annual_transits: [{
    year: 2010, sample_date: "2010-11-03",
    planets: [
      { name: "Jupiter" as const, longitude: 340, sign: "Pisces" as const, retrograde: false },
      { name: "Saturn" as const, longitude: 190, sign: "Libra" as const, retrograde: false },
    ],
    aspects: [
      { transit: "Jupiter" as const, natal: "Sun" as const, type: "trine" as const, orb: 0.5 },
      { transit: "Saturn" as const, natal: "Moon" as const, type: "trine" as const, orb: 1.2 },
      { transit: "Jupiter" as const, natal: "Moon" as const, type: "sextile" as const, orb: 2.0 },
    ],
  }],
  evidence_paths: { ascendant: "western.ascendant", natal_planets: "western.planets",
    annual_transits: "western.annual_transits" },
} as unknown as PremiumFacts["western"];

function fullFacts(): PremiumFacts {
  return {
    version: "v3", bazi: BAZI_FULL, ziwei: ZIWEI_FULL, vedic: VEDIC_FULL, western: WESTERN_FULL,
    unavailable: [],
  } as unknown as PremiumFacts;
}

describe("year-readings — self-heal invariants", () => {
  it("exports a stable FACTS_VERSION tag", () => {
    expect(typeof FACTS_VERSION).toBe("string");
    expect(FACTS_VERSION.length).toBeGreaterThan(0);
    expect(YEAR_READING_CALC_VERSION).toBe(FACTS_VERSION);
    expect(YEAR_READING_SKILL_VERSION).toMatch(/^year-reading@/);
  });

  it("hashFactsForYearReading shifts when any subset changes → stale cache rows are keyed out", () => {
    const a = hashFactsForYearReading(fullFacts());
    const mutated = fullFacts();
    (mutated.bazi as unknown as { day_master: { stem: string; element: string } })
      .day_master = { stem: "庚", element: "metal" };
    const b = hashFactsForYearReading(mutated);
    expect(a).not.toBe(b);
  });
});

describe("year-readings — current-chart four systems", () => {
  it("all four systems report available=true for target year 2010", () => {
    const r = readYear(fullFacts(), 2010, 7, "zh");
    expect(r.systems.bazi.available).toBe(true);
    expect(r.systems.ziwei.available).toBe(true);
    expect(r.systems.vedic.available).toBe(true);
    expect(r.systems.western.available).toBe(true);
    expect(r.unavailable_systems.length).toBe(0);
    expect(r.composite_score).not.toBeNull();
    expect(["mid", "high"]).toContain(r.composite_confidence);
    expect(validateYearReading(r).ok).toBe(true);
  });

  it("window covers the whole decade without unavailable placeholders when facts are complete", () => {
    const rs = readYearWindow(fullFacts(), 2003, 7, 9, "zh");
    expect(rs.length).toBe(3);
    for (const r of rs) {
      expect(r.systems.bazi.available).toBe(true);
      expect(r.systems.vedic.available).toBe(true);
    }
  });
});
