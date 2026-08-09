// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeEnergyScore, computeEnergyRange } from "./energy-score";

describe("energy-score deterministic module", () => {
  test("returns null when birthISO is missing/invalid", () => {
    expect(computeEnergyScore(undefined, 30)).toBeNull();
    expect(computeEnergyScore("", 30)).toBeNull();
    expect(computeEnergyScore("not-a-date", 30)).toBeNull();
    expect(computeEnergyRange(undefined, 30, 40)).toBeNull();
  });

  test("returns null for out-of-range age", () => {
    expect(computeEnergyScore("1990-05-14", -1)).toBeNull();
    expect(computeEnergyScore("1990-05-14", 200)).toBeNull();
  });

  test("scores are in [0, 100] and stable across calls", () => {
    const a = computeEnergyScore("1990-05-14", 36)!;
    const b = computeEnergyScore("1990-05-14", 36)!;
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  test("different birthdates → different curves", () => {
    const r1 = computeEnergyRange("1990-05-14", 30, 40)!;
    const r2 = computeEnergyRange("1985-11-02", 30, 40)!;
    expect(r1.map((p) => p.score)).not.toEqual(r2.map((p) => p.score));
  });

  test("computeEnergyRange covers [from, to)", () => {
    const r = computeEnergyRange("1990-05-14", 30, 40)!;
    expect(r).toHaveLength(10);
    expect(r[0].age).toBe(30);
    expect(r[9].age).toBe(39);
  });
});
