// @ts-expect-error — bun:test
import { describe, expect, test as it } from "bun:test";

import {
  DEFAULT_SCENARIO,
  PRESETS,
  VARIABLE_WEIGHTS,
  buildComposition,
  buildLifeSeries,
  clamp,
  contributionsAt,
  curatorSummary,
  reactionForChange,
  seedForChart,
  sensitivityAt,
  type FactorKey,
  type MathScenario,
  type VariableKey,
} from "./MathLifeModel";

const FACTORS: FactorKey[] = ["action", "recovery", "learning", "boundaries"];

function withVar(scenario: MathScenario, k: VariableKey, v: number): MathScenario {
  return { ...scenario, variables: { ...scenario.variables, [k]: v } };
}

describe("MathLifeModel · legacy series", () => {
  it("default scenario → baseline == scenario, choiceDelta 0", () => {
    const series = buildLifeSeries({ seed: "demo", fromAge: 20, toAge: 40, scenario: DEFAULT_SCENARIO });
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

  it("different seeds diverge", () => {
    const a = buildLifeSeries({ seed: "chart:1990-06-15", fromAge: 30, toAge: 30, scenario: DEFAULT_SCENARIO });
    const b = buildLifeSeries({ seed: "chart:1985-01-02", fromAge: 30, toAge: 30, scenario: DEFAULT_SCENARIO });
    expect(a[0].scenario).not.toBeCloseTo(b[0].scenario, 3);
  });

  it("clamps into [0, 100] under extreme sliders", () => {
    const extreme: MathScenario = { variables: { action: 100, recovery: 100, learning: 100, boundaries: 100 }, noise: 1 };
    const series = buildLifeSeries({ seed: "demo", fromAge: 0, toAge: 100, scenario: extreme });
    for (const p of series) {
      expect(p.scenario).toBeGreaterThanOrEqual(0);
      expect(p.scenario).toBeLessThanOrEqual(100);
      expect(p.bandLow).toBeLessThanOrEqual(p.bandHigh);
    }
  });

  it("noise only widens the band; totals unchanged", () => {
    const low = buildLifeSeries({ seed: "demo", fromAge: 10, toAge: 20, scenario: { ...DEFAULT_SCENARIO, noise: 0.05 } });
    const high = buildLifeSeries({ seed: "demo", fromAge: 10, toAge: 20, scenario: { ...DEFAULT_SCENARIO, noise: 0.95 } });
    for (let i = 0; i < low.length; i += 1) {
      expect(low[i].scenario).toBe(high[i].scenario);
      expect(high[i].bandHigh - high[i].bandLow).toBeGreaterThan(low[i].bandHigh - low[i].bandLow);
    }
  });

  it("returns [] for invalid or empty ranges", () => {
    expect(buildLifeSeries({ seed: "x", fromAge: 10, toAge: 5, scenario: DEFAULT_SCENARIO })).toEqual([]);
    expect(buildLifeSeries({ seed: "x", fromAge: NaN, toAge: 10, scenario: DEFAULT_SCENARIO })).toEqual([]);
  });

  it("sensitivityAt: action has largest bumped effect at age 30", () => {
    const s = sensitivityAt(30, "demo", DEFAULT_SCENARIO);
    for (const k of Object.keys(VARIABLE_WEIGHTS) as VariableKey[]) expect(s[k]).toBeGreaterThanOrEqual(0);
    const ranked = (Object.keys(s) as VariableKey[]).sort((a, b) => s[b] - s[a]);
    expect(ranked[0]).toBe("action");
  });

  it("curatorSummary mentions a factor and includes a caveat in both langs", () => {
    const bumped = withVar(DEFAULT_SCENARIO, "action", 90);
    const en = curatorSummary(30, "demo", bumped, "en");
    const zh = curatorSummary(30, "demo", bumped, "zh");
    expect(en).toMatch(/Action/);
    expect(en).toMatch(/interpretive/);
    expect(zh).toMatch(/行动/);
    expect(zh).toMatch(/规则生成/);
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

describe("MathLifeModel · composition", () => {
  const seed = "chart:1990-06-15";

  it("total = baseline + cycle + Σ factors (float tolerance)", () => {
    const comp = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: PRESETS.overload.variables ? { ...DEFAULT_SCENARIO, variables: PRESETS.overload.variables } : DEFAULT_SCENARIO });
    for (let i = 0; i < comp.ages.length; i += 1) {
      const sum =
        comp.baselineSeries[i] +
        comp.cycleSeries[i] +
        comp.factorSeries.action[i] +
        comp.factorSeries.recovery[i] +
        comp.factorSeries.learning[i] +
        comp.factorSeries.boundaries[i];
      const clampedSum = Math.max(0, Math.min(100, sum));
      expect(Math.abs(comp.totalSeries[i] - clampedSum)).toBeLessThan(0.05);
    }
  });

  it("changing one factor only changes its factorSeries and total", () => {
    const base = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: DEFAULT_SCENARIO });
    for (const k of FACTORS) {
      const changed = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: withVar(DEFAULT_SCENARIO, k, 75) });
      expect(changed.baselineSeries).toEqual(base.baselineSeries);
      expect(changed.cycleSeries).toEqual(base.cycleSeries);
      for (const other of FACTORS) {
        if (other === k) continue;
        // recovery affects band scale but never other factor series
        expect(changed.factorSeries[other]).toEqual(base.factorSeries[other]);
      }
      // its own series must differ somewhere
      expect(changed.factorSeries[k]).not.toEqual(base.factorSeries[k]);
      // total must move
      const changedAt30 = changed.totalSeries[30];
      const baseAt30 = base.totalSeries[30];
      expect(changedAt30).not.toBe(baseAt30);
    }
  });

  it("high action + low recovery triggers overload dip in the action series", () => {
    const stressed = buildComposition({
      seed, fromAge: 0, toAge: 80,
      scenario: { ...DEFAULT_SCENARIO, variables: { action: 90, recovery: 15, learning: 50, boundaries: 50 } },
    });
    expect(stressed.interactionFlags.overload).toBe(true);
    expect(stressed.interactionFlags.overloadAges.length).toBeGreaterThan(0);
    // long-term (age 70) action contribution must be smaller than short-term (age 5)
    const early = stressed.factorSeries.action[5];
    const late = stressed.factorSeries.action[70];
    expect(late).toBeLessThan(early);
  });

  it("higher recovery narrows the uncertainty band", () => {
    const low = buildComposition({ seed, fromAge: 30, toAge: 30, scenario: withVar(DEFAULT_SCENARIO, "recovery", 20) });
    const high = buildComposition({ seed, fromAge: 30, toAge: 30, scenario: withVar(DEFAULT_SCENARIO, "recovery", 90) });
    const wLow = low.bandHigh[0] - low.bandLow[0];
    const wHigh = high.bandHigh[0] - high.bandLow[0];
    expect(wHigh).toBeLessThan(wLow);
  });

  it("learning contribution grows with age and stays capped", () => {
    const lifted = buildComposition({ seed: "demo", fromAge: 0, toAge: 80, scenario: withVar(DEFAULT_SCENARIO, "learning", 100) });
    const early = lifted.factorSeries.learning[5];
    const mid = lifted.factorSeries.learning[40];
    const late = lifted.factorSeries.learning[75];
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThanOrEqual(mid - 0.01);
    for (const v of lifted.factorSeries.learning) expect(Math.abs(v)).toBeLessThanOrEqual(7.5);
  });

  it("boundaries contributes more where cycle stress is higher", () => {
    const comp = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: withVar(DEFAULT_SCENARIO, "boundaries", 100) });
    // sort ages by |cycle| and compare mean contribution
    const ranked = comp.ages
      .map((a, i) => ({ i, stress: Math.abs(comp.cycleSeries[i]), b: comp.factorSeries.boundaries[i] }))
      .sort((a, b) => b.stress - a.stress);
    const topN = ranked.slice(0, 10).reduce((s, r) => s + r.b, 0) / 10;
    const bottomN = ranked.slice(-10).reduce((s, r) => s + r.b, 0) / 10;
    expect(topN).toBeGreaterThan(bottomN);
  });

  it("three presets produce visibly different totals across the lifespan", () => {
    const comps = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((id) =>
      buildComposition({
        seed, fromAge: 0, toAge: 80,
        scenario: { ...DEFAULT_SCENARIO, variables: { ...PRESETS[id].variables } },
      }),
    );
    // Between any two presets, at least one age must show a >=2 total difference.
    for (let i = 0; i < comps.length; i += 1) {
      for (let j = i + 1; j < comps.length; j += 1) {
        let maxDiff = 0;
        for (let a = 0; a < comps[i].totalSeries.length; a += 1) {
          maxDiff = Math.max(maxDiff, Math.abs(comps[i].totalSeries[a] - comps[j].totalSeries[a]));
        }
        expect(maxDiff).toBeGreaterThan(2);
      }
    }
  });

  it("noise never changes deterministic totals/factors", () => {
    const low = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: { ...DEFAULT_SCENARIO, noise: 0 } });
    const high = buildComposition({ seed, fromAge: 0, toAge: 80, scenario: { ...DEFAULT_SCENARIO, noise: 1 } });
    expect(low.totalSeries).toEqual(high.totalSeries);
    expect(low.factorSeries).toEqual(high.factorSeries);
  });

  it("contributionsAt returns per-component decomposition summing to total", () => {
    const scenario = withVar(DEFAULT_SCENARIO, "action", 80);
    const comp = buildComposition({ seed, fromAge: 30, toAge: 30, scenario });
    const f = contributionsAt(30, comp);
    expect(f).not.toBeNull();
    if (!f) return;
    const sum = f.baseline + f.cycle + f.factors.action + f.factors.recovery + f.factors.learning + f.factors.boundaries;
    const clampedSum = Math.max(0, Math.min(100, sum));
    expect(Math.abs(f.total - clampedSum)).toBeLessThan(0.05);
  });

  it("reactionForChange returns a non-empty rule-based sentence in both langs", () => {
    const zh = reactionForChange("recovery", 50, 80, 30, "demo", DEFAULT_SCENARIO, "zh");
    const en = reactionForChange("recovery", 50, 80, 30, "demo", DEFAULT_SCENARIO, "en");
    expect(zh.length).toBeGreaterThan(5);
    expect(en.length).toBeGreaterThan(5);
    expect(en).toMatch(/Recovery/);
  });
});
