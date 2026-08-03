// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeDailyFacts, DAILY_FACTS_VERSION, noonUtcForLocalDate } from "./daily-facts";
import { computeWesternChart } from "./western-natal";

const NATAL_UTC = new Date(Date.UTC(1988, 5, 15, 8, 0, 0));

function natal() {
  const c = computeWesternChart({ utc: NATAL_UTC, lat: 31.23, lng: 121.47 });
  if (!c) throw new Error("natal compute failed");
  return c;
}

describe("noonUtcForLocalDate", () => {
  test("Asia/Shanghai noon = 04:00 UTC same day", () => {
    const d = noonUtcForLocalDate("2026-07-21", "Asia/Shanghai")!;
    expect(d.toISOString()).toBe("2026-07-21T04:00:00.000Z");
  });
  test("America/Los_Angeles noon in July (PDT, UTC-7) = 19:00 UTC", () => {
    const d = noonUtcForLocalDate("2026-07-21", "America/Los_Angeles")!;
    expect(d.toISOString()).toBe("2026-07-21T19:00:00.000Z");
  });
  test("America/Los_Angeles noon in January (PST, UTC-8) = 20:00 UTC — handles DST", () => {
    const d = noonUtcForLocalDate("2026-01-15", "America/Los_Angeles")!;
    expect(d.toISOString()).toBe("2026-01-15T20:00:00.000Z");
  });
  test("invalid date → null", () => {
    expect(noonUtcForLocalDate("nope", "UTC")).toBeNull();
  });
  test("invalid tz → null", () => {
    expect(noonUtcForLocalDate("2026-07-21", "Not/A/Zone")).toBeNull();
  });
});

describe("computeDailyFacts — determinism & shape", () => {
  const n = natal();
  test("identical input → byte-identical output", () => {
    const a = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "Asia/Shanghai" });
    const b = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "Asia/Shanghai" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test("9 transit planets, valid signs, calculator version pinned", () => {
    const f = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "UTC" })!;
    expect(f.calculator_version).toBe(DAILY_FACTS_VERSION);
    expect(f.transit_planets.length).toBe(9);
    for (const p of f.transit_planets) {
      expect(p.trop_lon).toBeGreaterThanOrEqual(0);
      expect(p.trop_lon).toBeLessThan(360);
      expect(p.sign).toBeGreaterThanOrEqual(0);
      expect(p.sign).toBeLessThan(12);
    }
  });
  test("moon phase in enum, illumination 0..100", () => {
    const f = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "UTC" })!;
    expect([
      "new_moon", "waxing_crescent", "first_quarter", "waxing_gibbous",
      "full_moon", "waning_gibbous", "last_quarter", "waning_crescent",
    ]).toContain(f.moon.phase);
    expect(f.moon.illumination_pct).toBeGreaterThanOrEqual(0);
    expect(f.moon.illumination_pct).toBeLessThanOrEqual(100);
  });
  test("no aspect exceeds its orb budget", () => {
    const f = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "UTC" })!;
    for (const a of f.transit_to_natal_aspects) {
      expect(a.orb).toBeLessThanOrEqual(6 + 1e-9);
    }
  });
  test("timezone shifts the sample UTC accordingly", () => {
    const shanghai = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "Asia/Shanghai" })!;
    const utc = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "UTC" })!;
    expect(shanghai.sample_utc).not.toBe(utc.sample_utc);
  });
});
