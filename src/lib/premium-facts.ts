/**
 * Immutable, locally-derived facts for the Premium Deep Reading.
 *
 * The AI narrative layer is ONLY allowed to cite facts that appear in
 * this object. Anything not here (e.g. house cusps, progressions) is
 * deliberately absent — the reading engine must not invent chart data.
 *
 * v3 (premium_facts_v3) sources — all deterministic, local:
 *   - BaZi:    lunar-javascript pillars + `EightChar.getYun(gender)` for
 *              起运 / 大运 / 流年 (see bazi-luck.ts).
 *   - Ziwei:   iztro palaces + `chart.horoscope(date)` for 大限 / 流年
 *              / 流月 (see ziwei-horoscope.ts). Horoscope is time-relative
 *              and included only when `buildPremiumFacts` is called with
 *              an explicit `asOfDate`, to keep cache-key inputs stable.
 *   - Western: 9-planet tropical geocentric longitudes, retrograde flags,
 *              and major aspects (see western-natal.ts); Ascendant when
 *              lat/lng resolvable.
 *   - Vedic:   9-graha sidereal + Moon nakshatra + full Vimshottari with
 *              Antardasha expansion (see vedic-dasha.ts). Pratyantar is
 *              populated only for the active AD when `asOfDate` given.
 *
 * Back-compat: readers of legacy v1/v2 content_json rows must treat any
 * v3-only field as optional. The version string is bumped so cache keys
 * incorporating it get a new row; existing paid reports keep their v1/v2
 * content and their original cache row untouched.
 */
import type { CalculationSnapshot } from "./calc-snapshot";
import type { ZiweiChart, ZiweiPalace } from "./ziwei";
import { computeBaZiLuck, computeBaZiTransient, type BaZiLuck, type BaZiTransient } from "./bazi-luck";
import { computeZiweiHoroscope, type ZiweiHoroscope } from "./ziwei-horoscope";
import {
  computeWesternChart,
  computeWholeSignHouses,
  computeSecondaryProgression,
  type WesternAspect,
  type WesternPlanet,
  type WesternAscendant,
  type WholeSignHouse,
} from "./western-natal";
import { computeAnnualTransit } from "./western-transits";
import { expandVimshottari, currentDashaTriple, type DashaExpansion } from "./vedic-dasha";
import { localBirthToUTC } from "./city-geo";

export const PREMIUM_FACTS_VERSION = "premium_facts_v4";


/* ---------- BaZi element counts ---------- */

const STEM_ELEMENT: Record<string, BaZiElement> = {
  甲: "wood", 乙: "wood",
  丙: "fire", 丁: "fire",
  戊: "earth", 己: "earth",
  庚: "metal", 辛: "metal",
  壬: "water", 癸: "water",
};
const BRANCH_ELEMENT: Record<string, BaZiElement> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood",
  辰: "earth", 巳: "fire", 午: "fire", 未: "earth",
  申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
};
export type BaZiElement = "wood" | "fire" | "earth" | "metal" | "water";

/** Classical ten-god (十神) — day-master relative role of each other stem. */
const YIN_STEMS = new Set(["乙", "丁", "己", "辛", "癸"]);
const TEN_GOD_TABLE: Record<
  BaZiElement,
  Record<BaZiElement, [string, string]>
> = {
  wood:  { wood: ["比肩", "劫财"], fire:  ["食神", "伤官"], earth: ["偏财", "正财"], metal: ["七杀", "正官"], water: ["偏印", "正印"] },
  fire:  { fire: ["比肩", "劫财"], earth: ["食神", "伤官"], metal: ["偏财", "正财"], water: ["七杀", "正官"], wood:  ["偏印", "正印"] },
  earth: { earth:["比肩", "劫财"], metal: ["食神", "伤官"], water: ["偏财", "正财"], wood:  ["七杀", "正官"], fire:  ["偏印", "正印"] },
  metal: { metal:["比肩", "劫财"], water: ["食神", "伤官"], wood:  ["偏财", "正财"], fire:  ["七杀", "正官"], earth: ["偏印", "正印"] },
  water: { water:["比肩", "劫财"], wood:  ["食神", "伤官"], fire:  ["偏财", "正财"], earth: ["七杀", "正官"], metal: ["偏印", "正印"] },
};

export function tenGodOf(dayStem: string, otherStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem];
  const os = STEM_ELEMENT[otherStem];
  if (!dm || !os) return null;
  const dmYin = YIN_STEMS.has(dayStem);
  const osYin = YIN_STEMS.has(otherStem);
  const [same, opp] = TEN_GOD_TABLE[dm][os];
  return dmYin === osYin ? same : opp;
}

/* ---------- Fact shapes ---------- */

export type BaZiFacts = {
  pillars: { year: string; month: string; day: string; hour: string | null };
  day_master: { stem: string; element: BaZiElement } | null;
  ten_gods: Array<{ pillar: "year" | "month" | "hour"; stem: string; label: string | null }>;
  element_counts: Record<BaZiElement, number>;
  zodiac: { zh: string; en: string } | null;
  /** v3: 起运 + 大运柱 + 流年 (from lunar-javascript EightChar.getYun). */
  luck: BaZiLuck | null;
  /** v4: 流月/流日/流时 for a target moment — populated only with asOfDate. */
  transient: BaZiTransient | null;
  evidence_paths: {
    year_pillar: "bazi.pillars.year";
    month_pillar: "bazi.pillars.month";
    day_pillar: "bazi.pillars.day";
    hour_pillar: "bazi.pillars.hour";
    day_master: "bazi.day_master";
    luck_pillars: "bazi.luck.pillars";
    luck_start: "bazi.luck.start";
    transient: "bazi.transient";
  };
};



export type ZiweiFacts = {
  soul: string;
  body: string;
  five_elements_class: string;
  lunar_date: string;
  soul_palace_index: number;
  palaces: Array<{
    index: number;
    name: string;
    heavenly_stem: string;
    earthly_branch: string;
    is_body_palace: boolean;
    major_stars: Array<{ name: string; brightness: string | null; mutagen: string | null }>;
    minor_stars: string[];
  }>;
  /** v3: 大限 / 流年 / 流月 — populated only when asOfDate is provided. */
  horoscope: ZiweiHoroscope | null;
  /**
   * v3.1: Multi-year Zi Wei horoscope snapshots — one entry per calendar
   * year in the year-reading window. Populated when `opts.ziweiYears` is
   * passed to `buildPremiumFacts`. Each entry is a full `ZiweiHoroscope`
   * anchored on a birthday-in-year sample date. The single-year
   * `horoscope` field above is preserved for v3 cache compat.
   */
  horoscope_years?: ZiweiHoroscope[];
  evidence_paths: {
    soul_palace: `ziwei.palaces[${number}]`;
    five_elements_class: "ziwei.five_elements_class";
    horoscope: "ziwei.horoscope";
    horoscope_years: "ziwei.horoscope_years";
  };
};

export type WesternProgression = {
  as_of_date: string;
  age_years: number;
  planets: WesternPlanet[];
  aspects: WesternAspect[];
  ascendant: WesternAscendant | null;
};

export type WesternFacts = {
  sun: { sign_en: string; sign_zh: string; element: "fire" | "earth" | "air" | "water" };
  /** v3: 9 luminaries + major aspects + Ascendant (when lat/lng resolvable). */
  planets: WesternPlanet[];
  aspects: WesternAspect[];
  ascendant: WesternAscendant | null;
  /**
   * v3.1: One annual-transit snapshot per year in the reading window.
   * Populated when `opts.transitYears` is supplied to `buildPremiumFacts`.
   */
  annual_transits?: import("./western-transits").WesternAnnualTransit[];
  /** v4: Whole-Sign 12 house cusps — deterministic from Ascendant. */
  houses_whole_sign: WholeSignHouse[] | null;
  /** v4: Secondary progression (1 day = 1 year) at asOfDate — planets only. */
  progression: WesternProgression | null;
  evidence_paths: {
    sun: "western.sun";
    planets: "western.planets";
    aspects: "western.aspects";
    ascendant: "western.ascendant";
    annual_transits: "western.annual_transits";
    houses_whole_sign: "western.houses_whole_sign";
    progression: "western.progression";
  };
};


export type VedicFacts = {
  ascendant_sign: number | null;
  moon: { sign: number; nakshatra_en: string; nakshatra_zh: string; pada: number };
  vimshottari_current: { lord: string; startISO: string; endISO: string } | null;
  vimshottari_next: { lord: string; startISO: string; endISO: string } | null;
  /** v3: full Mahadasha timeline with Antardasha per MD (Pratyantar for the active AD only). */
  mahadasha: DashaExpansion["mahadasha"];
  /** v3: currently-active MD / AD / PD triple, when `asOfDate` provided. */
  current: null | {
    mahadasha_lord: string;
    antardasha_lord: string | null;
    pratyantar_lord: string | null;
    as_of_date: string;
  };
  /** Whether Pratyantar level passed 120-year / sub-period validation. */
  pratyantar_available: boolean;
  evidence_paths: {
    moon: "vedic.moon";
    dasha: "vedic.mahadasha";
    current: "vedic.current";
  };
};

export type PremiumFacts = {
  version: string;
  bazi: BaZiFacts | null;
  ziwei: ZiweiFacts | null;
  western: WesternFacts | null;
  vedic: VedicFacts | null;
  /** Modules honestly NOT wired locally — never invented by AI. */
  unavailable: string[];
};

/* ---------- Derivation ---------- */

export type BuildFactsOptions = {
  /**
   * When provided (YYYY-MM-DD), enables time-relative facts:
   *   - Ziwei horoscope (大限/流年/流月)
   *   - Vedic Pratyantar for the currently-active AD
   *   - Vedic `current` MD/AD/PD triple
   * When omitted, cache-key inputs stay stable across days.
   */
  asOfDate?: string | null;
  /**
   * v4: Optional HH:MM anchor for hour-level facts (bazi 流时, ziwei 流时).
   * When omitted, hourly modules are populated only where a sensible
   * fallback exists (e.g. Ziwei falls back to the birth time index for
   * daily continuity; BaZi 流时 stays null).
   */
  asOfTime?: string | null;
  /**
   * v3.1: List of birthday-anchored YYYY-MM-DD dates. When provided the
   * Ziwei derivation returns a `horoscope_years[]` array, one entry per
   * date. Used by the year-reading engine to produce per-year 流年 facts.
   */
  ziweiYears?: string[] | null;
  /**
   * v3.1: List of calendar years for which to compute deterministic
   * Western annual-transit charts. When provided AND the natal chart
   * is resolvable, `WesternFacts.annual_transits` is populated with one
   * entry per year (birthday-anchored 12:00 UTC samples).
   */
  transitYears?: number[] | null;
};

export function deriveBaziFacts(
  snap: CalculationSnapshot,
  opts: BuildFactsOptions = {},
): BaZiFacts | null {
  if (snap.bazi.status !== "ok" || !snap.bazi.pillars) return null;
  const p = snap.bazi.pillars;
  const dm = snap.bazi.day_master;
  const counts: Record<BaZiElement, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const addPillar = (pillar: string | null) => {
    if (!pillar || pillar.length < 2) return;
    const s = pillar.charAt(0);
    const b = pillar.charAt(1);
    if (STEM_ELEMENT[s]) counts[STEM_ELEMENT[s]] += 1;
    if (BRANCH_ELEMENT[b]) counts[BRANCH_ELEMENT[b]] += 1;
  };
  addPillar(p.year);
  addPillar(p.month);
  addPillar(p.day);
  addPillar(p.hour);
  const dayStem = dm?.stem ?? "";
  const tenGods: BaZiFacts["ten_gods"] = [];
  if (dayStem) {
    for (const [pillar, gz] of [
      ["year", p.year],
      ["month", p.month],
      ["hour", p.hour],
    ] as const) {
      if (!gz || gz === p.day) continue;
      const stem = gz.charAt(0);
      const label = tenGodOf(dayStem, stem);
      tenGods.push({ pillar, stem, label });
    }
  }
  // v3: compute 起运 + 大运 + 流年 from lunar-javascript. Requires gender.
  let luck: BaZiLuck | null = null;
  const gender = snap.ziwei.chart?.gender ?? null;
  if (snap.input.date && snap.input.time && gender) {
    luck = computeBaZiLuck({
      date: snap.input.date,
      time: snap.input.time,
      gender,
    });
  }
  // v4: transient 流月/流日/流时 for asOfDate.
  const transient = opts.asOfDate
    ? computeBaZiTransient({ asOfDate: opts.asOfDate, asOfTime: opts.asOfTime ?? null })
    : null;
  return {
    pillars: p,
    day_master: dm,
    ten_gods: tenGods,
    element_counts: counts,
    zodiac: snap.bazi.zodiac,
    luck,
    transient,
    evidence_paths: {
      year_pillar: "bazi.pillars.year",
      month_pillar: "bazi.pillars.month",
      day_pillar: "bazi.pillars.day",
      hour_pillar: "bazi.pillars.hour",
      day_master: "bazi.day_master",
      luck_pillars: "bazi.luck.pillars",
      luck_start: "bazi.luck.start",
      transient: "bazi.transient",
    },
  };
}


export function deriveZiweiFacts(
  snap: CalculationSnapshot,
  opts: BuildFactsOptions = {},
): ZiweiFacts | null {
  if (snap.ziwei.status !== "ok" || !snap.ziwei.chart) return null;
  const c: ZiweiChart = snap.ziwei.chart;
  let horoscope: ZiweiHoroscope | null = null;
  if (opts.asOfDate && snap.input.date && snap.input.time) {
    horoscope = computeZiweiHoroscope({
      birth_solar_date: snap.input.date,
      birth_time: snap.input.time,
      gender: c.gender,
      as_of_date: opts.asOfDate,
    });
  }
  let horoscope_years: ZiweiHoroscope[] | undefined;
  if (opts.ziweiYears && opts.ziweiYears.length > 0 && snap.input.date && snap.input.time) {
    const out: ZiweiHoroscope[] = [];
    const seen = new Set<string>();
    for (const asOf of opts.ziweiYears) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) continue;
      if (seen.has(asOf)) continue;
      seen.add(asOf);
      const h = computeZiweiHoroscope({
        birth_solar_date: snap.input.date,
        birth_time: snap.input.time,
        gender: c.gender,
        as_of_date: asOf,
      });
      if (h) out.push(h);
    }
    if (out.length > 0) horoscope_years = out;
  }
  return {
    soul: c.soul,
    body: c.body,
    five_elements_class: c.five_elements_class,
    lunar_date: c.lunar_date,
    soul_palace_index: c.soul_palace_index,
    palaces: c.palaces.map((p: ZiweiPalace) => ({
      index: p.index,
      name: p.name,
      heavenly_stem: p.heavenly_stem,
      earthly_branch: p.earthly_branch,
      is_body_palace: p.is_body_palace,
      major_stars: p.major_stars,
      minor_stars: p.minor_stars,
    })),
    horoscope,
    horoscope_years,
    evidence_paths: {
      soul_palace: `ziwei.palaces[${c.soul_palace_index}]` as const,
      five_elements_class: "ziwei.five_elements_class",
      horoscope: "ziwei.horoscope",
      horoscope_years: "ziwei.horoscope_years",
    },
  };
}

export function deriveWesternFacts(
  snap: CalculationSnapshot,
  opts: BuildFactsOptions = {},
): WesternFacts | null {
  if (snap.western.status !== "ok" || !snap.western.sun) return null;
  // v3: compute 9-planet tropical natal + aspects when date+time+geo allow.
  let planets: WesternPlanet[] = [];
  let aspects: WesternAspect[] = [];
  let ascendant: WesternAscendant | null = null;
  if (snap.input.date && snap.input.time && snap.geo) {
    const utc = localBirthToUTC(snap.input.date, snap.input.time, snap.geo.tz);
    if (utc) {
      const chart = computeWesternChart({ utc, lat: snap.geo.lat, lng: snap.geo.lng });
      if (chart) {
        planets = chart.planets;
        aspects = chart.aspects;
        ascendant = chart.ascendant;
      }
    }
  }
  // v3.1: annual transits — birthday-anchored samples against natal frame.
  let annual_transits: import("./western-transits").WesternAnnualTransit[] = [];
  if (planets.length && snap.input.date && Array.isArray(opts.transitYears) && opts.transitYears.length) {
    const uniq = Array.from(new Set(opts.transitYears.filter((y) => Number.isFinite(y)))).sort((a, b) => a - b);
    for (let i = 0; i < uniq.length; i += 1) {
      const entry = computeAnnualTransit({
        natal: planets,
        natalAscendantLon: ascendant?.trop_lon ?? null,
        birthDateISO: snap.input.date,
        year: uniq[i],
        arrayIndex: i,
      });
      if (entry) annual_transits.push(entry);
    }
  }
  return {
    sun: {
      sign_en: snap.western.sun.sign_en,
      sign_zh: snap.western.sun.sign_zh,
      element: snap.western.sun.element,
    },
    planets,
    aspects,
    ascendant,
    annual_transits,
    evidence_paths: {
      sun: "western.sun",
      planets: "western.planets",
      aspects: "western.aspects",
      ascendant: "western.ascendant",
      annual_transits: "western.annual_transits",
    },
  };
}


export function deriveVedicFacts(
  snap: CalculationSnapshot,
  opts: BuildFactsOptions = {},
): VedicFacts | null {
  if (snap.vedic.status !== "ok" || !snap.vedic.chart) return null;
  const c = snap.vedic.chart;
  const dasha = c.vimshottari ?? [];
  const moonPlanet = c.planets.find((p) => p.key === "moon");

  // v3: expand Antardasha for every MD; PD for the AD active at asOfDate.
  const anchor = opts.asOfDate ? new Date(opts.asOfDate + "T12:00:00Z") : new Date(dasha[0]?.start ?? Date.now());
  const expansion = expandVimshottari(dasha, anchor);
  let current: VedicFacts["current"] = null;
  if (opts.asOfDate) {
    const triple = currentDashaTriple(expansion, anchor);
    if (triple.mahadasha) {
      current = {
        mahadasha_lord: triple.mahadasha.lord,
        antardasha_lord: triple.antardasha?.lord ?? null,
        pratyantar_lord: triple.pratyantar?.lord ?? null,
        as_of_date: opts.asOfDate,
      };
    }
  }

  return {
    ascendant_sign: c.ascendant?.sign ?? null,
    moon: {
      sign: moonPlanet?.sign ?? -1,
      nakshatra_en: c.moon.nakshatra_en,
      nakshatra_zh: c.moon.nakshatra_zh,
      pada: c.moon.pada,
    },
    vimshottari_current: dasha[0]
      ? { lord: dasha[0].lord, startISO: dasha[0].start, endISO: dasha[0].end }
      : null,
    vimshottari_next: dasha[1]
      ? { lord: dasha[1].lord, startISO: dasha[1].start, endISO: dasha[1].end }
      : null,
    mahadasha: expansion.mahadasha,
    current,
    pratyantar_available: expansion.pratyantar_available,
    evidence_paths: {
      moon: "vedic.moon",
      dasha: "vedic.mahadasha",
      current: "vedic.current",
    },
  };
}

/**
 * Modules honestly not wired locally in v3. AI narrative must NOT claim
 * to interpret any of these. Zi Wei 流日/流时 and BaZi 流月/流日 are
 * beyond the libraries' surfaced APIs; Western house cusps require a
 * house-system implementation we haven't audited.
 */
export const HONESTLY_UNAVAILABLE_MODULES = [
  "ziwei_liu_ri",
  "ziwei_liu_shi",
  "bazi_liu_yue",
  "bazi_liu_ri",
  "bazi_liu_shi",
  "western_house_cusps",
  "western_progressions",
  "western_transits",
] as const;

export function buildPremiumFacts(
  snap: CalculationSnapshot,
  opts: BuildFactsOptions = {},
): PremiumFacts {
  const vedic = deriveVedicFacts(snap, opts);
  const unavailable: string[] = [...HONESTLY_UNAVAILABLE_MODULES];
  // If Pratyantar level failed validation, honestly disclose it.
  if (vedic && !vedic.pratyantar_available) unavailable.push("vedic_pratyantar_validation_failed");
  return {
    version: PREMIUM_FACTS_VERSION,
    bazi: deriveBaziFacts(snap),
    ziwei: deriveZiweiFacts(snap, opts),
    western: deriveWesternFacts(snap, opts),
    vedic,
    unavailable,
  };
}

/**
 * Resolve a dotted/bracketed evidence path (e.g. "bazi.pillars.day",
 * "ziwei.palaces[0].major_stars[1].name") against a facts object.
 * Undefined result → the path does not exist and any AI claim citing
 * it must be rejected.
 */
export function resolveFactsPath(facts: PremiumFacts, path: string): unknown {
  const tokens = path.split(/[.[\]]/).filter(Boolean);
  let cur: unknown = facts;
  for (const tok of tokens) {
    if (cur == null) return undefined;
    if (/^\d+$/.test(tok)) {
      const arr = cur as unknown[];
      cur = arr[+tok];
    } else {
      cur = (cur as Record<string, unknown>)[tok];
    }
  }
  return cur;
}
