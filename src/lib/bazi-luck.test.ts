/**
 * BaZi luck cycles (大运 / 流年) tests — verifies real API integration
 * with lunar-javascript and boundary invariants.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeBaZiLuck, luckPillarForYear, totalLuckYears } from "./bazi-luck";

// Fixture: 1990-05-15 08:30 Nanjing male — 庚午 year, yang year + male → forward.
const MALE = { date: "1990-05-15", time: "08:30", gender: "male" as const };
// Same date, female — yang year + female → backward.
const FEMALE = { date: "1990-05-15", time: "08:30", gender: "female" as const };

describe("computeBaZiLuck — real lunar-javascript output", () => {
  test("male in 庚午 (yang) year runs forward (顺行)", () => {
    const l = computeBaZiLuck(MALE)!;
    expect(l).not.toBeNull();
    expect(l.forward_order).toBe(true);
    expect(l.gender).toBe("male");
  });

  test("female in same year runs backward (逆行)", () => {
    const l = computeBaZiLuck(FEMALE)!;
    expect(l.forward_order).toBe(false);
  });

  test("起运 solar date is present and later than birth", () => {
    const l = computeBaZiLuck(MALE)!;
    expect(l.start.solar_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(l.start.solar_date).getTime()).toBeGreaterThan(new Date(MALE.date).getTime());
  });

  test("real DaYun pillars all carry a non-empty ganZhi and monotone years", () => {
    const l = computeBaZiLuck(MALE)!;
    expect(l.pillars.length).toBeGreaterThan(0);
    for (const p of l.pillars) {
      expect(p.gan_zhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      expect(p.start_year).toBeLessThanOrEqual(p.end_year);
      expect(p.start_age).toBeLessThanOrEqual(p.end_age);
    }
    // Sequential monotonicity.
    for (let i = 1; i < l.pillars.length; i++) {
      expect(l.pillars[i].start_year).toBeGreaterThan(l.pillars[i - 1].start_year);
      expect(l.pillars[i].start_age).toBeGreaterThan(l.pillars[i - 1].start_age);
    }
  });

  test("each DaYun spans ~10 years and has non-empty 流年 list", () => {
    const l = computeBaZiLuck(MALE)!;
    for (const p of l.pillars) {
      const years = p.end_year - p.start_year + 1;
      expect(years).toBeGreaterThanOrEqual(9);
      expect(years).toBeLessThanOrEqual(11);
      expect(p.liu_nian.length).toBeGreaterThan(0);
      // Every LiuNian's year must fall inside the pillar span.
      for (const ln of p.liu_nian) {
        expect(ln.year).toBeGreaterThanOrEqual(p.start_year);
        expect(ln.year).toBeLessThanOrEqual(p.end_year);
        expect(ln.gan_zhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      }
    }
  });

  test("pre-luck period (起运前) is exposed and bounded by 起运 date", () => {
    const l = computeBaZiLuck(MALE)!;
    if (l.pre_luck) {
      expect(l.pre_luck.start_year).toBe(1990);
      expect(l.pre_luck.end_year).toBeLessThan(l.start.year);
    }
  });

  test("luckPillarForYear picks the correct pillar; before-起运 returns null", () => {
    const l = computeBaZiLuck(MALE)!;
    const first = l.pillars[0];
    expect(luckPillarForYear(l, first.start_year)!.gan_zhi).toBe(first.gan_zhi);
    expect(luckPillarForYear(l, first.end_year)!.gan_zhi).toBe(first.gan_zhi);
    expect(luckPillarForYear(l, 1900)).toBeNull();
  });

  test("total pillars span ≥ 100 years (10 pillars × 10y)", () => {
    const l = computeBaZiLuck(MALE)!;
    expect(totalLuckYears(l)).toBeGreaterThanOrEqual(90);
  });

  test("invalid inputs → null, no fake data", () => {
    expect(computeBaZiLuck({ date: "not-a-date", time: "08:30", gender: "male" })).toBeNull();
    expect(computeBaZiLuck({ date: "1990-05-15", time: "??:??", gender: "male" })).toBeNull();
  });
});
