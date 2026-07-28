import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCENARIO,
  buildLifeSeries,
  clamp,
  curatorSummary,
  seedForChart,
  sensitivityAt,
  VARIABLE_WEIGHTS,
  type MathScenario,
  type VariableKey,
} from "./MathLifeModel";

describe("MathLifeModel", () => {
  it("default scenario produces a series with baseline == scenario (Σwi·Xi = 0)", () => {
    const series = buildLifeSeries({
      seed: "demo",
      fromAge: 20,
      toAge: 40,
      scenario: DEFAULT_SCENARIO,
    });
    expect(series.length).toBe(21);
    for (const p of series) {
      expect(p.baseline).toBeCloseTo(p.scenario, 5);
      expect(p.choiceDelta).toBe(0);
    }
  });

  it("is deterministic for the same seed + scenario", () => {
    const a = buildLifeSeries({ seed: "chart:1990-06-15", fromAge: 0, toAge: 80, scenario: DEFAULT_SCENARIO });
    const b = buildLifeSeries({ seed: "chart:1990-06-15", fromAge: 0, toAge: 80, scenario: DEFAULT_SCENARIO });
    expect(a).toEqual(b);
  });

  it("different seeds diverge (phases + baseline differ)", () => {
    const a = buildLifeSeries({ seed: "chart:1990-06-15", fromAge: 30, toAge: 30, scenario: DEFAULT_SCENARIO });
    const b = buildLifeSeries({ seed: "chart:1985-01-02", fromAge: 30, toAge: 30, scenario: DEFAULT_SCENARIO });
    expect(a[0].scenario).not.toBeCloseTo(b[0].scenario, 3);
  });

  it("clamps scenario/baseline into [0, 100] even with extreme sliders", () => {
    const extreme: MathScenario = {
      variables: { action: 100, recovery: 100, learning: 100, boundaries: 100 },
      noise: 1,
    };
    const series = buildLifeSeries({ seed: "demo", fromAge: 0, toAge: 100, scenario: extreme });
    for (const p of series) {
      expect(p.scenario).toBeGreaterThanOrEqual(0);
      expect(p.scenario).toBeLessThanOrEqual(100);
      expect(p.bandLow).toBeGreaterThanOrEqual(0);
      expect(p.bandHigh).toBeLessThanOrEqual(100);
      expect(p.bandLow).toBeLessThanOrEqual(p.bandHigh);
    }
  });

  it("noise only widens the band — scenario/baseline unchanged", () => {
    const low = buildLifeSeries({
      seed: "demo",
      fromAge: 10,
      toAge: 20,
      scenario: { ...DEFAULT_SCENARIO, noise: 0.05 },
    });
    const high = buildLifeSeries({
      seed: "demo",
      fromAge: 10,
      toAge: 20,
      scenario: { ...DEFAULT_SCENARIO, noise: 0.95 },
    });
    for (let i = 0; i < low.length; i += 1) {
      expect(low[i].scenario).toBe(high[i].scenario);
      expect(low[i].baseline).toBe(high[i].baseline);
      expect(high[i].bandHigh - high[i].bandLow).toBeGreaterThan(low[i].bandHigh - low[i].bandLow);
    }
  });

  it("returns [] for invalid or empty ranges", () => {
    expect(buildLifeSeries({ seed: "x", fromAge: 10, toAge: 5, scenario: DEFAULT_SCENARIO })).toEqual([]);
    expect(buildLifeSeries({ seed: "x", fromAge: NaN, toAge: 10, scenario: DEFAULT_SCENARIO })).toEqual([]);
  });

  it("sensitivityAt returns one non-negative value per variable and matches weight ordering", () => {
    const s = sensitivityAt(30, "demo", DEFAULT_SCENARIO);
    for (const k of Object.keys(VARIABLE_WEIGHTS) as VariableKey[]) {
      expect(s[k]).toBeGreaterThanOrEqual(0);
    }
    // action has the largest weight, so its bumped sensitivity must be the largest.
    const ranked = (Object.keys(s) as VariableKey[]).sort((a, b) => s[b] - s[a]);
    expect(ranked[0]).toBe("action");
  });

  it("curatorSummary is rule-based and mentions the leading variable in both langs", () => {
    const focus = 30;
    const series = buildLifeSeries({ seed: "demo", fromAge: focus, toAge: focus, scenario: DEFAULT_SCENARIO });
    const sens = sensitivityAt(focus, "demo", DEFAULT_SCENARIO);
    expect(curatorSummary(focus, series, sens, "en")).toMatch(/Action/);
    expect(curatorSummary(focus, series, sens, "zh")).toMatch(/行动投入/);
  });

  it("seedForChart falls back for missing / invalid ISO strings", () => {
    expect(seedForChart(null)).toBe("demo");
    expect(seedForChart(undefined)).toBe("demo");
    expect(seedForChart("not-a-date")).toBe("demo");
    expect(seedForChart("1990-06-15")).toBe("chart:1990-06-15");
  });

  it("clamp respects bounds", () => {
    expect(clamp(-10)).toBe(0);
    expect(clamp(110)).toBe(100);
    expect(clamp(42)).toBe(42);
  });
});
