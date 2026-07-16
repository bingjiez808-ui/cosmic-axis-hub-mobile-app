/**
 * Calculation snapshot + consistency validator tests.
 *
 * Anchors on serena, 2002-11-03 09:26 Nanjing (female):
 *   Western: tropical Sun in Scorpio (water)
 *   BaZi:    lunar-javascript four pillars, day-master stem defined
 *   Vedic:   Lahiri sidereal Moon in Hasta pada 4, dasha starts under Moon
 *   Ziwei:   iztro — 命宫紫微·七杀, 火六局, 身宫主星 火星
 *
 * With gender omitted, Ziwei must remain unavailable (gender_missing), so
 * the paid deep-report gate stays blocked — the honest failure mode when
 * we cannot compute one required system.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import {
  buildCalculationSnapshot,
  CALCULATION_VERSION,
  elementForSign,
  missingSystems,
  tropicalSunSignFromDate,
  validateEvidenceAgainstSnapshot,
} from "./calc-snapshot";

describe("tropicalSunSignFromDate", () => {
  test("2002-11-03 → Scorpio (idx 7, water)", () => {
    const s = tropicalSunSignFromDate("2002-11-03");
    expect(s).toBe(7);
    expect(elementForSign(s!)).toBe("water");
  });
  test("boundary: 2002-11-22 → Sagittarius", () => {
    expect(tropicalSunSignFromDate("2002-11-22")).toBe(8);
  });
  test("boundary: 2002-10-23 → Scorpio", () => {
    expect(tropicalSunSignFromDate("2002-10-23")).toBe(7);
  });
  test("invalid input → null", () => {
    expect(tropicalSunSignFromDate("")).toBeNull();
    expect(tropicalSunSignFromDate("not-a-date")).toBeNull();
  });
});

describe("buildCalculationSnapshot — Nanjing 2002-11-03 09:26 (female)", () => {
  const snap = buildCalculationSnapshot({
    date: "2002-11-03",
    time: "09:26",
    place: "Nanjing",
    lang: "zh",
    gender: "female",
  });

  test("stamps version + generated_at", () => {
    expect(snap.calculation_version).toBe(CALCULATION_VERSION);
    expect(typeof snap.generated_at).toBe("string");
    expect(snap.geo?.tz).toBe("Asia/Shanghai");
  });

  test("western: Sun in Scorpio, water element", () => {
    expect(snap.western.status).toBe("ok");
    expect(snap.western.sun?.sign_zh).toBe("天蝎");
    expect(snap.western.sun?.element).toBe("water");
  });

  test("bazi: real four pillars, day-master stem present", () => {
    expect(snap.bazi.status).toBe("ok");
    expect(snap.bazi.pillars?.day).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(snap.bazi.day_master?.stem).toBe(snap.bazi.pillars!.day.charAt(0));
  });

  test("vedic: Lahiri sidereal Sun in Libra, Moon in Hasta pada 4, dasha starts with Moon", () => {
    expect(snap.vedic.status).toBe("ok");
    const chart = snap.vedic.chart!;
    // Ayanamsa ≈ 23.9° in late 2002
    expect(chart.ayanamsa_deg).toBeGreaterThan(23.8);
    expect(chart.ayanamsa_deg).toBeLessThan(24.0);
    const sun = chart.planets.find((p) => p.key === "sun")!;
    expect(sun.sign).toBe(6); // Libra sidereal
    const moon = chart.planets.find((p) => p.key === "moon")!;
    expect(moon.sign).toBe(5); // Virgo sidereal
    expect(chart.moon.nakshatra_en).toBe("Hasta");
    expect(chart.moon.pada).toBe(4);
    expect(chart.vimshottari[0]?.lord).toBe("Moon");
    // Ascendant computed since Nanjing lat/lng resolved
    expect(chart.ascendant).not.toBeNull();
  });

  test("ziwei: 命宫紫微·七杀, 火六局, 身宫主星 火星", () => {
    expect(snap.ziwei.status).toBe("ok");
    const chart = snap.ziwei.chart!;
    expect(chart.five_elements_class).toBe("火六局");
    expect(chart.body).toBe("火星");
    const soul = chart.palaces[chart.soul_palace_index];
    const stars = soul.major_stars.map((s) => s.name).sort();
    expect(stars).toContain("紫微");
    expect(stars).toContain("七杀");
  });

  test("missingSystems empty → paid gate opens", () => {
    expect(missingSystems(snap)).toEqual([]);
  });
});

describe("gender / place gates", () => {
  test("no gender → ziwei blocked with gender_missing", () => {
    const snap = buildCalculationSnapshot({
      date: "2002-11-03", time: "09:26", place: "Nanjing", lang: "zh",
    });
    expect(snap.ziwei.status).toBe("unavailable");
    expect(snap.ziwei.reason).toBe("gender_missing");
    expect(missingSystems(snap)).toContain("ziwei");
  });

  test("unknown place → vedic blocked with birthplace_unresolved", () => {
    const snap = buildCalculationSnapshot({
      date: "2002-11-03", time: "09:26", place: "Atlantis City", lang: "en", gender: "female",
    });
    expect(snap.vedic.status).toBe("unavailable");
    expect(snap.vedic.reason).toBe("birthplace_unresolved");
    expect(missingSystems(snap)).toContain("vedic");
  });

  test("missing time → both time-sensitive systems blocked", () => {
    const snap = buildCalculationSnapshot({
      date: "2002-11-03", place: "Nanjing", lang: "zh", gender: "female",
    });
    expect(snap.vedic.status).toBe("unavailable");
    expect(snap.ziwei.status).toBe("unavailable");
  });

  test("all missing", () => {
    const empty = buildCalculationSnapshot({});
    expect(missingSystems(empty).sort()).toEqual(["bazi", "vedic", "western", "ziwei"]);
  });
});

describe("validateEvidenceAgainstSnapshot", () => {
  const snap = buildCalculationSnapshot({
    date: "2002-11-03", time: "09:26", place: "Nanjing", lang: "zh", gender: "female",
  });

  test("flags '太阳落火象' contradiction against Scorpio (water)", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "西方占星", note: "太阳落火象 · 水星逆行于第三宫" },
    ]);
    expect(issues.some((i) => i.code === "sun_element_mismatch")).toBe(true);
  });

  test("accepts a correct water-element Sun claim", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "西方占星", note: "太阳落天蝎 · 水象 · 情感深、蜕变型" },
    ]);
    expect(issues.filter((i) => i.code === "sun_element_mismatch")).toEqual([]);
  });

  test("flags mismatched day-master stem", () => {
    const wrongStem = "甲乙丙丁戊己庚辛壬癸".split("").find((s) => s !== snap.bazi.day_master!.stem)!;
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "八字", note: `日主 ${wrongStem} · 十神显发` },
    ]);
    expect(issues.some((i) => i.code === "day_master_mismatch")).toBe(true);
  });

  test("flags wrong Moon Nakshatra citation (Ashwini vs Hasta)", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "Jyotish", note: "Moon in Ashwini pada 1 — impulsive drive" },
    ]);
    expect(issues.some((i) => i.code === "moon_nakshatra_mismatch")).toBe(true);
  });

  test("accepts correct Hasta Nakshatra citation", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "Jyotish", note: "Moon in Hasta pada 4 — dexterity, patience" },
      { tradition: "印度占星", note: "月亮 轸宿·pada 4" },
    ]);
    expect(issues.filter((i) => i.code === "moon_nakshatra_mismatch")).toEqual([]);
  });

  test("flags a 命宫主星 claim that does not match iztro output", () => {
    // The real soul palace holds 紫微+七杀. "天机" must be flagged.
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "紫微", note: "命宫天机 · 智慧星入命" },
    ]);
    expect(issues.some((i) => i.code === "ziwei_soul_star_mismatch")).toBe(true);
  });

  test("accepts 命宫紫微 (真实主星之一)", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "紫微", note: "命宫紫微·七杀 权星·杀气两全" },
    ]);
    expect(issues.filter((i) => i.code === "ziwei_soul_star_mismatch")).toEqual([]);
  });
});
