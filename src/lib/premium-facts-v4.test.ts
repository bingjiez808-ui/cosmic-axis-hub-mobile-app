/**
 * v4 facts-layer regression — deterministic, real-library outputs for the
 * modules promoted from unavailable → available: BaZi 流月/流日/流时,
 * Zi Wei 流日/流时, Western Whole-Sign houses, and Western secondary
 * progression. Everything comes from lunar-javascript / iztro /
 * astronomy-engine — no AI, no fabricated values.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { buildCalculationSnapshot } from "./calc-snapshot";
import { buildPremiumFacts, PREMIUM_FACTS_VERSION } from "./premium-facts";
import { computeBaZiTransient } from "./bazi-luck";
import { computeWholeSignHouses, computeSecondaryProgression, computeWesternChart } from "./western-natal";

const NANJING = {
  date: "2002-11-03",
  time: "09:26",
  place: "Nanjing",
  lang: "zh" as const,
  gender: "female" as const,
};

describe("PREMIUM_FACTS_VERSION", () => {
  test("bumped to v4 so cache rows re-key and old rows self-heal", () => {
    expect(PREMIUM_FACTS_VERSION).toBe("premium_facts_v4");
  });
});

describe("BaZi transient (流月/流日/流时)", () => {
  test("day/month/year ganzhi are real 2-character strings; hour null when asOfTime omitted", () => {
    const t = computeBaZiTransient({ asOfDate: "2026-01-15" })!;
    expect(t).not.toBeNull();
    expect(t.liu_nian).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(t.liu_yue).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(t.liu_ri).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(t.liu_shi).toBeNull();
  });
  test("hour ganzhi populated when asOfTime provided", () => {
    const t = computeBaZiTransient({ asOfDate: "2026-01-15", asOfTime: "10:30" })!;
    expect(t.liu_shi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
  });
  test("deterministic — same inputs → identical output", () => {
    const a = computeBaZiTransient({ asOfDate: "2026-01-15", asOfTime: "10:30" });
    const b = computeBaZiTransient({ asOfDate: "2026-01-15", asOfTime: "10:30" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test("invalid date → null (never fabricated)", () => {
    expect(computeBaZiTransient({ asOfDate: "bad-date" })).toBeNull();
  });
});

describe("Zi Wei horoscope daily/hourly (v4)", () => {
  const facts = buildPremiumFacts(buildCalculationSnapshot(NANJING), {
    asOfDate: "2026-01-15",
    asOfTime: "10:30",
  });
  test("daily is present with palace 0..11 and mutagen array", () => {
    const d = facts.ziwei!.horoscope!.daily!;
    expect(d).not.toBeNull();
    expect(d.index).toBeGreaterThanOrEqual(0);
    expect(d.index).toBeLessThan(12);
    expect(Array.isArray(d.mutagen)).toBe(true);
  });
  test("hourly is present when asOfTime supplied; as_of_time_index set", () => {
    const h = facts.ziwei!.horoscope!.hourly!;
    expect(h).not.toBeNull();
    expect(facts.ziwei!.horoscope!.as_of_time_index).not.toBeNull();
  });
  test("hourly is null when asOfTime omitted", () => {
    const factsNoTime = buildPremiumFacts(buildCalculationSnapshot(NANJING), { asOfDate: "2026-01-15" });
    expect(factsNoTime.ziwei!.horoscope!.hourly).toBeNull();
    expect(factsNoTime.ziwei!.horoscope!.as_of_time_index).toBeNull();
  });
});

describe("Western Whole-Sign houses", () => {
  test("12 houses, cusp_lon multiples of 30, house 1 sits on Ascendant sign", () => {
    const houses = computeWholeSignHouses(4)!; // Leo asc → h1 Leo, h2 Virgo, …
    expect(houses.length).toBe(12);
    expect(houses[0].sign).toBe(4);
    expect(houses[0].cusp_lon).toBe(120);
    expect(houses[11].sign).toBe(3);
    for (const h of houses) {
      expect(h.cusp_lon % 30).toBe(0);
      expect(h.sign).toBeGreaterThanOrEqual(0);
      expect(h.sign).toBeLessThan(12);
    }
  });
  test("invalid ascSign → null", () => {
    expect(computeWholeSignHouses(-1)).toBeNull();
    expect(computeWholeSignHouses(12)).toBeNull();
  });
  test("built-in via buildPremiumFacts is 12 houses when ascendant available", () => {
    const facts = buildPremiumFacts(buildCalculationSnapshot(NANJING));
    expect(facts.western!.houses_whole_sign?.length).toBe(12);
  });
});

describe("Western secondary progression (1 day = 1 year)", () => {
  const NATAL_UTC = new Date("2000-01-01T12:00:00Z");
  test("advances the natal moment by ageYears days, returns 9 progressed planets", () => {
    const prog = computeSecondaryProgression({ natal_utc: NATAL_UTC, age_years: 25, lat: 51.5, lng: -0.1 })!;
    expect(prog).not.toBeNull();
    expect(prog.planets.length).toBe(9);
    // Compare vs computing the chart directly at natal + 25 days.
    const direct = computeWesternChart({
      utc: new Date(NATAL_UTC.getTime() + 25 * 86_400_000),
      lat: 51.5, lng: -0.1,
    })!;
    const sunProg = prog.planets.find((p) => p.key === "sun")!;
    const sunDirect = direct.planets.find((p) => p.key === "sun")!;
    expect(sunProg.trop_lon).toBeCloseTo(sunDirect.trop_lon, 6);
  });
  test("deterministic — same natal + age → identical planets", () => {
    const a = computeSecondaryProgression({ natal_utc: NATAL_UTC, age_years: 10 })!;
    const b = computeSecondaryProgression({ natal_utc: NATAL_UTC, age_years: 10 })!;
    expect(JSON.stringify(a.planets)).toBe(JSON.stringify(b.planets));
  });
  test("negative age_years → null", () => {
    expect(computeSecondaryProgression({ natal_utc: NATAL_UTC, age_years: -1 })).toBeNull();
  });
  test("buildPremiumFacts populates progression only with asOfDate + geo + time", () => {
    const noDate = buildPremiumFacts(buildCalculationSnapshot(NANJING));
    expect(noDate.western!.progression).toBeNull();
    const withDate = buildPremiumFacts(buildCalculationSnapshot(NANJING), { asOfDate: "2026-01-15" });
    expect(withDate.western!.progression).not.toBeNull();
    expect(withDate.western!.progression!.planets.length).toBe(9);
  });
});
