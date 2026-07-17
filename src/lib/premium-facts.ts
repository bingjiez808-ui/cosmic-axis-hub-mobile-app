/**
 * Immutable, locally-derived facts for the Premium Deep Reading.
 *
 * The AI narrative layer is ONLY allowed to cite facts that appear in
 * this object. Anything not here (e.g. Zi Wei liu-nian, Vedic sub-dasha
 * pratyantar) is deliberately absent — the reading engine must not
 * invent chart data. The reader UI renders these as a "chart facts"
 * section, visually distinct from AI narrative.
 *
 * Sources:
 *   - BaZi: `lunar-javascript` pillars → local element counts + day
 *     master. Ten-god relationships are computed via the classical
 *     stem-to-stem rule; nothing beyond what the pillars determine.
 *   - Ziwei: whatever `iztro` returned — soul/body/五行局 and the
 *     twelve palaces with their major stars, brightness, and mutagen.
 *     Ten-year 大限 / 流年 are NOT computed here (see report at the
 *     bottom of `PremiumReportReader` — honestly hidden as unavailable).
 *   - Western: tropical Sun + element.
 *   - Vedic: 9-graha placements, Moon nakshatra + pada, and current +
 *     next Vimshottari mahadasha slice (dasha *sub-periods* not wired).
 *
 * The evidence-path helper lets tests and AI-response validators point
 * at exactly which snapshot field backs a claim.
 */
import type { CalculationSnapshot } from "./calc-snapshot";
import type { ZiweiChart, ZiweiPalace } from "./ziwei";

export const PREMIUM_FACTS_VERSION = "premium_facts_v1";

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
const ELEMENTS: BaZiElement[] = ["wood", "fire", "earth", "metal", "water"];

/** Classical ten-god (十神) — day-master relative role of each other stem. */
const YIN_STEMS = new Set(["乙", "丁", "己", "辛", "癸"]);
const TEN_GOD_TABLE: Record<
  BaZiElement,
  Record<BaZiElement, [string, string]> // [same-yang-yin ten-god, opposite]
> = {
  //   [same-polarity 十神, opposite-polarity 十神]
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
  /** Provenance — every claim in AI narrative must map back here. */
  evidence_paths: {
    year_pillar: "bazi.pillars.year";
    month_pillar: "bazi.pillars.month";
    day_pillar: "bazi.pillars.day";
    hour_pillar: "bazi.pillars.hour";
    day_master: "bazi.day_master";
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
  evidence_paths: {
    soul_palace: `ziwei.palaces[${number}]`;
    five_elements_class: "ziwei.five_elements_class";
  };
};

export type WesternFacts = {
  sun: { sign_en: string; sign_zh: string; element: "fire" | "earth" | "air" | "water" };
  evidence_paths: { sun: "western.sun" };
};

export type VedicFacts = {
  ascendant_sign: number | null;
  moon: { sign: number; nakshatra_en: string; nakshatra_zh: string; pada: number };
  vimshottari_current: { lord: string; startISO: string; endISO: string } | null;
  vimshottari_next: { lord: string; startISO: string; endISO: string } | null;
  evidence_paths: {
    moon: "vedic.chart.moon";
    dasha: "vedic.chart.vimshottari";
  };
};

export type PremiumFacts = {
  version: string;
  bazi: BaZiFacts | null;
  ziwei: ZiweiFacts | null;
  western: WesternFacts | null;
  vedic: VedicFacts | null;
  /**
   * Which analytical modules are honestly NOT yet wired locally.
   * The AI narrative MUST NOT claim to interpret any of these.
   */
  unavailable: string[];
};

/* ---------- Derivation ---------- */

export function deriveBaziFacts(snap: CalculationSnapshot): BaZiFacts | null {
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
  return {
    pillars: p,
    day_master: dm,
    ten_gods: tenGods,
    element_counts: counts,
    zodiac: snap.bazi.zodiac,
    evidence_paths: {
      year_pillar: "bazi.pillars.year",
      month_pillar: "bazi.pillars.month",
      day_pillar: "bazi.pillars.day",
      hour_pillar: "bazi.pillars.hour",
      day_master: "bazi.day_master",
    },
  };
}

export function deriveZiweiFacts(snap: CalculationSnapshot): ZiweiFacts | null {
  if (snap.ziwei.status !== "ok" || !snap.ziwei.chart) return null;
  const c: ZiweiChart = snap.ziwei.chart;
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
    evidence_paths: {
      soul_palace: `ziwei.palaces[${c.soul_palace_index}]` as const,
      five_elements_class: "ziwei.five_elements_class",
    },
  };
}

export function deriveWesternFacts(snap: CalculationSnapshot): WesternFacts | null {
  if (snap.western.status !== "ok" || !snap.western.sun) return null;
  return {
    sun: {
      sign_en: snap.western.sun.sign_en,
      sign_zh: snap.western.sun.sign_zh,
      element: snap.western.sun.element,
    },
    evidence_paths: { sun: "western.sun" },
  };
}

export function deriveVedicFacts(snap: CalculationSnapshot): VedicFacts | null {
  if (snap.vedic.status !== "ok" || !snap.vedic.chart) return null;
  const c = snap.vedic.chart;
  const dasha = c.vimshottari ?? [];
  const moonPlanet = c.planets.find((p) => p.key === "moon");
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
    evidence_paths: { moon: "vedic.chart.moon", dasha: "vedic.chart.vimshottari" },
  };
}

/** Modules that are honestly NOT wired locally — never invented by AI. */
export const HONESTLY_UNAVAILABLE_MODULES = [
  "ziwei_da_xian_10year",
  "ziwei_liu_nian",
  "ziwei_liu_yue",
  "vedic_antardasha",
  "vedic_pratyantar",
  "bazi_da_yun_luck_pillars",
] as const;

export function buildPremiumFacts(snap: CalculationSnapshot): PremiumFacts {
  return {
    version: PREMIUM_FACTS_VERSION,
    bazi: deriveBaziFacts(snap),
    ziwei: deriveZiweiFacts(snap),
    western: deriveWesternFacts(snap),
    vedic: deriveVedicFacts(snap),
    unavailable: [...HONESTLY_UNAVAILABLE_MODULES],
  };
}

/**
 * Given a dotted/bracketed path (e.g. "bazi.pillars.day",
 * "ziwei.palaces[0].major_stars[1].name"), resolve it against
 * a facts object. Returns undefined when the path does not exist.
 * Used by tests and AI-output validators to prove that every claim
 * cites an existing field.
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
