// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import {
  annualSampleUtc,
  computeAnnualTransit,
  scoreAnnualTransit,
  WESTERN_TRANSITS_VERSION,
} from "./western-transits";
import { computeWesternChart } from "./western-natal";

const NATAL_UTC = new Date(Date.UTC(1988, 5, 15, 8, 0, 0)); // 1988-06-15 08:00 UTC

function natal() {
  const c = computeWesternChart({ utc: NATAL_UTC, lat: 31.23, lng: 121.47 });
  if (!c) throw new Error("natal compute failed");
  return c;
}

describe("annualSampleUtc — sampling rule", () => {
  test("normal MM-DD → 12:00 UTC that year", () => {
    const d = annualSampleUtc("1988-06-15", 2024)!;
    expect(d.toISOString()).toBe("2024-06-15T12:00:00.000Z");
  });
  test("leap-day birthday falls back to 02-28 in non-leap years", () => {
    const d = annualSampleUtc("1988-02-29", 2023)!;
    expect(d.toISOString()).toBe("2023-02-28T12:00:00.000Z");
  });
  test("leap-day birthday keeps 02-29 in leap years", () => {
    const d = annualSampleUtc("1988-02-29", 2024)!;
    expect(d.toISOString()).toBe("2024-02-29T12:00:00.000Z");
  });
  test("out-of-range year → null", () => {
    expect(annualSampleUtc("1988-06-15", 1800)).toBeNull();
    expect(annualSampleUtc("1988-06-15", 2300)).toBeNull();
  });
});

describe("computeAnnualTransit — determinism & shape", () => {
  const n = natal();
  test("same natal + year → byte-identical output (no Math.random)", () => {
    const a = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: 2024, arrayIndex: 0 });
    const b = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: 2024, arrayIndex: 0 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test("returns 9 transit planets with sign 0..11", () => {
    const t = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: 2024, arrayIndex: 3 })!;
    expect(t.planets.length).toBe(9);
    for (const p of t.planets) {
      expect(p.trop_lon).toBeGreaterThanOrEqual(0);
      expect(p.trop_lon).toBeLessThan(360);
      expect(p.sign).toBeGreaterThanOrEqual(0);
      expect(p.sign).toBeLessThan(12);
    }
    expect(t.evidence_paths.planets).toBe("western.annual_transits[3].planets");
    expect(t.calculator_version).toBe(WESTERN_TRANSITS_VERSION);
  });
  test("orb budget honored — no aspect exceeds its listed orb", () => {
    const t = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: 2024, arrayIndex: 0 })!;
    for (const a of t.aspects) {
      const rule = t.orb_table.find((r) => r.kind === a.kind)!;
      expect(a.orb).toBeLessThanOrEqual(rule.orb + 1e-9);
    }
  });
  test("10-year window all-available and each has aspects", () => {
    for (let y = 2020; y < 2030; y += 1) {
      const t = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: y, arrayIndex: 0 })!;
      expect(t).not.toBeNull();
      expect(t.aspects.length).toBeGreaterThan(0);
    }
  });
});

describe("scoreAnnualTransit — deterministic mapping", () => {
  const n = natal();
  test("score in [0,100] and stable across repeat calls", () => {
    const t = computeAnnualTransit({ natal: n.planets, birthDateISO: "1988-06-15", year: 2025, arrayIndex: 0 })!;
    const a = scoreAnnualTransit(t);
    const b = scoreAnnualTransit(t);
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });
});
