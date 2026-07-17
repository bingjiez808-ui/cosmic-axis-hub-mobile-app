// @ts-expect-error bun:test
import { describe, it, expect } from "bun:test";
import type { PremiumFacts } from "./premium-facts";
import {
  readYear,
  readYearWindow,
  tenGodOf,
  validateYearReading,
  hashFactsForYearReading,
  YEAR_READING_SKILL_VERSION,
} from "./year-readings";

/* ---------------- Fixture builder ---------------- */

function baseFacts(over: Partial<PremiumFacts> = {}): PremiumFacts {
  return {
    version: "v3",
    bazi: null,
    ziwei: null,
    western: null,
    vedic: null,
    unavailable: [],
    ...over,
  };
}

const BAZI_FULL = {
  pillars: { year: "甲子", month: "丙寅", day: "丁未", hour: "壬寅" },
  day_master: { stem: "丁", element: "fire" as const },
  ten_gods: [],
  element_counts: { wood: 2, fire: 2, earth: 1, metal: 0, water: 3 },
  zodiac: { zh: "鼠", en: "Rat" },
  luck: {
    source: "lunar-javascript",
    gender: "male" as const,
    forward_order: true,
    start: {
      solar_date: "1985-05-01", year: 1985, month: 5, day: 1,
      offset_years: 1, offset_months: 0, offset_days: 0, nominal_start_age: 2,
    },
    pre_luck: null,
    pillars: [
      {
        index: 0, gan_zhi: "丁卯", start_year: 1985, end_year: 1994,
        start_age: 2, end_age: 11, xun: null, xun_kong: null,
        liu_nian: [
          { year: 1990, gan_zhi: "庚午", nominal_age: 7 },
          { year: 1991, gan_zhi: "辛未", nominal_age: 8 },
        ],
      },
      {
        index: 1, gan_zhi: "戊辰", start_year: 1995, end_year: 2004,
        start_age: 12, end_age: 21, xun: null, xun_kong: null,
        liu_nian: [
          { year: 2000, gan_zhi: "庚辰", nominal_age: 17 },
        ],
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
  mahadasha: [
    {
      lord: "Jupiter" as const, start: "1988-01-01T00:00:00Z", end: "2004-01-01T00:00:00Z",
      years: 16, antardasha: [
        { lord: "Jupiter" as const, start: "1988-01-01T00:00:00Z", end: "1991-01-01T00:00:00Z", years: 3, pratyantar: [] },
        { lord: "Saturn"  as const, start: "1991-01-01T00:00:00Z", end: "1993-06-01T00:00:00Z", years: 2.5, pratyantar: [] },
      ],
    },
    {
      lord: "Saturn" as const, start: "2004-01-01T00:00:00Z", end: "2023-01-01T00:00:00Z",
      years: 19, antardasha: [],
    },
  ],
  current: null,
  pratyantar_available: false,
  evidence_paths: { moon: "vedic.moon", dasha: "vedic.mahadasha", current: "vedic.current" },
} as unknown as PremiumFacts["vedic"];

/* ---------------- Ten-god scaffold ---------------- */

describe("tenGodOf", () => {
  it("computes classic relationships from day master 丁 (yin fire)", () => {
    expect(tenGodOf("丁", "丁")).toBe("比肩");
    expect(tenGodOf("丁", "丙")).toBe("劫财");
    expect(tenGodOf("丁", "戊")).toBe("伤官"); // fire生土, different yin/yang
    expect(tenGodOf("丁", "庚")).toBe("正财"); // 丁(yin) 克 庚(yang) → 正财
    expect(tenGodOf("丁", "壬")).toBe("正官"); // 壬(yang) 克 丁(yin) → 正官
  });
});

/* ---------------- Availability matrix ---------------- */

describe("readYear availability", () => {
  it("with all 4 systems missing returns reference_only composite", () => {
    const r = readYear(baseFacts(), 1990, 7, "zh");
    expect(r.composite_score).toBeNull();
    expect(r.composite_confidence).toBe("reference_only");
    expect(r.unavailable_systems).toEqual(expect.arrayContaining(["bazi", "ziwei", "vedic", "western"]));
    expect(validateYearReading(r).ok).toBe(true);
  });

  it("with only BaZi available (1 system) composite = single-system reference", () => {
    const r = readYear(baseFacts({ bazi: BAZI_FULL }), 1990, 7, "zh");
    expect(r.systems.bazi.available).toBe(true);
    expect(r.systems.vedic.available).toBe(false);
    expect(r.composite_confidence).toBe("reference_only");
    expect(validateYearReading(r).ok).toBe(true);
  });

  it("with BaZi + Vedic (2 systems) produces weighted composite", () => {
    const r = readYear(baseFacts({ bazi: BAZI_FULL, vedic: VEDIC_FULL }), 1990, 7, "zh");
    expect(r.systems.bazi.available).toBe(true);
    expect(r.systems.vedic.available).toBe(true);
    expect(r.composite_score).toBeGreaterThanOrEqual(15);
    expect(r.composite_score).toBeLessThanOrEqual(90);
    expect(r.composite_confidence === "mid" || r.composite_confidence === "high").toBe(true);
    expect(validateYearReading(r).ok).toBe(true);
  });

  it("year outside bazi luck window → bazi unavailable, does not fabricate", () => {
    const r = readYear(baseFacts({ bazi: BAZI_FULL }), 2100, 117, "zh");
    expect(r.systems.bazi.available).toBe(false);
    expect(r.systems.bazi.reason_unavailable).toBeTruthy();
  });
});

/* ---------------- Determinism ---------------- */

describe("determinism", () => {
  it("same facts, same year → identical content_hash", () => {
    const f = baseFacts({ bazi: BAZI_FULL, vedic: VEDIC_FULL });
    const a = readYear(f, 1990, 7, "zh");
    const b = readYear(f, 1990, 7, "zh");
    expect(a.content_hash).toBe(b.content_hash);
  });
  it("different lang → different content_hash but same score", () => {
    const f = baseFacts({ bazi: BAZI_FULL, vedic: VEDIC_FULL });
    const zh = readYear(f, 1990, 7, "zh");
    const en = readYear(f, 1990, 7, "en");
    expect(zh.content_hash).not.toBe(en.content_hash);
    expect(zh.composite_score).toBe(en.composite_score);
  });
  it("facts_hash changes when bazi facts change", () => {
    const a = hashFactsForYearReading(baseFacts({ bazi: BAZI_FULL }));
    const b = hashFactsForYearReading(baseFacts({ bazi: BAZI_FULL, vedic: VEDIC_FULL }));
    expect(a).not.toBe(b);
  });
});

/* ---------------- Safety wording ---------------- */

describe("safety", () => {
  it("advice never asserts medical/death/guaranteed-wealth wording", () => {
    const rs = readYearWindow(
      baseFacts({ bazi: BAZI_FULL, vedic: VEDIC_FULL }),
      1983, 7, 20, "zh",
    );
    const forbidden = ["治疗", "疾病", "死亡", "灾难", "保证", "包赚", "必然发财"];
    for (const r of rs) {
      const blob = JSON.stringify(r);
      for (const w of forbidden) expect(blob).not.toContain(w);
    }
  });
  it("SKILL_VERSION is a stable string", () => {
    expect(YEAR_READING_SKILL_VERSION).toMatch(/^year-reading@\d+\.\d+\.\d+$/);
  });
});
