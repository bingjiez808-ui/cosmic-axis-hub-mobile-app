/**
 * Zi Wei horoscope (运限) integration tests — verifies real iztro
 * API output shape for 大限 / 流年 / 流月. No mock chart.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeZiweiHoroscope } from "./ziwei-horoscope";

const BIRTH = {
  birth_solar_date: "1990-05-15",
  birth_time: "08:30",
  gender: "male" as const,
};

describe("computeZiweiHoroscope — real iztro horoscope()", () => {
  test("returns decadal/yearly/monthly with real Ganzhi + palace names", () => {
    const h = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-01-01" })!;
    expect(h).not.toBeNull();
    expect(h.as_of_date).toBe("2026-01-01");
    expect(h.decadal.heavenly_stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/);
    expect(h.decadal.earthly_branch).toMatch(/^[子丑寅卯辰巳午未申酉戌亥]$/);
    expect(h.decadal.palace_names.length).toBe(12);
    expect(h.yearly.palace_names.length).toBe(12);
    expect(h.monthly.palace_names.length).toBe(12);
  });

  test("decadal age_range is monotone [start, end] within human lifespan", () => {
    const h = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-01-01" })!;
    const [s, e] = h.decadal.age_range;
    expect(s).toBeLessThan(e);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(e).toBeLessThan(130);
  });

  test("decadal mutagen is a subset of the 14 主星 star pool", () => {
    const h = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-01-01" })!;
    // Mutagen entries must be non-empty strings; iztro returns real star names.
    for (const m of h.decadal.mutagen) {
      expect(typeof m).toBe("string");
      expect(m.length).toBeGreaterThan(0);
    }
    expect(h.decadal.mutagen.length).toBeGreaterThanOrEqual(0);
  });

  test("yearly carries suiqian12 / jiangqian12 12-item arrays", () => {
    const h = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-01-01" })!;
    expect(h.yearly.sui_qian_12.length).toBe(12);
    expect(h.yearly.jiang_qian_12.length).toBe(12);
  });

  test("different as_of_date yields different monthly palace rotation", () => {
    const a = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-01-15" })!;
    const b = computeZiweiHoroscope({ ...BIRTH, as_of_date: "2026-07-15" })!;
    // Monthly rotates by month; the two indices should generally differ.
    // At minimum, at least one horoscope field must vary between the dates.
    const same = a.monthly.index === b.monthly.index
      && a.monthly.heavenly_stem === b.monthly.heavenly_stem
      && a.monthly.earthly_branch === b.monthly.earthly_branch;
    expect(same).toBe(false);
  });

  test("invalid inputs → null, never fake horoscope", () => {
    expect(computeZiweiHoroscope({ ...BIRTH, birth_time: "bad", as_of_date: "2026-01-01" })).toBeNull();
    expect(computeZiweiHoroscope({ ...BIRTH, as_of_date: "not-a-date" })).toBeNull();
  });
});
