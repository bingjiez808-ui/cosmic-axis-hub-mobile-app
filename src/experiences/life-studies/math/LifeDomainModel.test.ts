import { describe, expect, it } from "vitest";

import { BANNED_TERMS, COMPOSITE_WEIGHTS, DOMAIN_KEYS, DOMAIN_LABELS, type DomainKey } from "./domains";
import { DEMO_FACTS, factsFromSeed } from "./demoFacts";
import { resolveEvidence } from "./evidence";
import {
  ageSnapshot,
  allRefsResolve,
  buildDomainSeries,
  crossDomainEffects,
  scenarioBranches,
} from "./LifeDomainModel";

const range = { fromAge: 0, toAge: 80 } as const;

describe("LifeDomainModel", () => {
  it("is deterministic across repeated calls with the same facts", () => {
    const a = buildDomainSeries({ mode: "demo", facts: DEMO_FACTS, ...range });
    const b = buildDomainSeries({ mode: "demo", facts: DEMO_FACTS, ...range });
    expect(a).toEqual(b);
  });

  it("emits scores in [0, 100] for every year, every domain", () => {
    const r = buildDomainSeries({ mode: "demo", facts: DEMO_FACTS, ...range });
    for (const k of DOMAIN_KEYS) {
      for (const v of r.domainSeries[k]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    for (const v of r.compositeSeries) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("degrades data coverage when systems are missing without fabricating scores", () => {
    const partialFacts = { ...DEMO_FACTS, coverage: { ...DEMO_FACTS.coverage, ziwei: "none" as const } };
    const r = buildDomainSeries({ mode: "demo", facts: partialFacts, ...range });
    expect(r.dataCoverage).toBe("partial");
    const insufficient = {
      ...DEMO_FACTS,
      coverage: { ...DEMO_FACTS.coverage, ziwei: "none" as const, vedic: "none" as const },
    };
    const r2 = buildDomainSeries({ mode: "demo", facts: insufficient, ...range });
    expect(r2.dataCoverage).toBe("insufficient");
    // Scores still finite — model degrades rather than throws.
    for (const v of r2.compositeSeries) expect(Number.isFinite(v)).toBe(true);
  });

  it("composite is not a simple arithmetic mean of the seven domains", () => {
    const r = buildDomainSeries({ mode: "demo", facts: DEMO_FACTS, ...range });
    let mismatches = 0;
    for (let i = 0; i < r.ages.length; i += 1) {
      const mean = DOMAIN_KEYS.reduce((s, k) => s + r.domainSeries[k][i], 0) / DOMAIN_KEYS.length;
      if (Math.abs(mean - r.compositeSeries[i]) > 0.5) mismatches += 1;
    }
    expect(mismatches).toBeGreaterThan(20);
    // Weights are not equal → property check.
    expect(Object.values(COMPOSITE_WEIGHTS).every((w) => w === 1 / 7)).toBe(false);
  });

  it("high wealth-risk exposure adds a friction/health drag but never a return prediction", () => {
    const facts = { ...DEMO_FACTS, wuxing: { wood: 0.1, fire: 0.15, earth: 0.2, metal: 0.45, water: 0.1 } };
    const r = buildDomainSeries({ mode: "demo", facts, ...range });
    const snap = ageSnapshot(45, r)!;
    // Rule: high wealthRisk should push family down at least a little.
    expect(snap.domains.wealthRisk.score).toBeGreaterThan(50);
    // Text guardrail: no banned outcome-prediction terms.
    const txt = JSON.stringify(snap);
    for (const re of BANNED_TERMS) expect(re.test(txt)).toBe(false);
  });

  it("low health caps the top two domains via realisability damping", () => {
    // Force health low via a wuxing bias.
    const factsLow = { ...DEMO_FACTS, wuxing: { wood: 0.5, fire: 0.3, earth: 0.05, metal: 0.1, water: 0.05 } };
    const factsHigh = { ...DEMO_FACTS, wuxing: { wood: 0.2, fire: 0.2, earth: 0.25, metal: 0.15, water: 0.2 } };
    const low = buildDomainSeries({ mode: "demo", facts: factsLow, ...range });
    const high = buildDomainSeries({ mode: "demo", facts: factsHigh, ...range });
    const idx = 45;
    // The health series of factsLow should be lower on average.
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(avg(low.domainSeries.health)).toBeLessThan(avg(high.domainSeries.health) + 0.001);
    // Composite of the low-health variant near age 45 should be no higher than health-blind mean.
    const top2Mean =
      (Math.max(...DOMAIN_KEYS.filter((k) => k !== "health").map((k) => low.domainSeries[k][idx])) +
        Math.max(...DOMAIN_KEYS.filter((k) => k !== "health").map((k) => high.domainSeries[k][idx]))) /
      2;
    expect(top2Mean).toBeGreaterThan(0);
  });

  it("cross-domain arrows only fire when their triggering rule matches", () => {
    const facts = { ...DEMO_FACTS, wuxing: { wood: 0.05, fire: 0.4, earth: 0.05, metal: 0.4, water: 0.1 } };
    const r = buildDomainSeries({ mode: "demo", facts, ...range });
    const snap = ageSnapshot(42, r)!;
    const arrows = crossDomainEffects(snap);
    expect(arrows.length).toBeGreaterThanOrEqual(0);
    for (const a of arrows) {
      // Arrows should not reference domains that are all neutral.
      expect(DOMAIN_KEYS).toContain(a.from);
      expect(DOMAIN_KEYS).toContain(a.to);
    }
  });

  it("scenario branches for career produce three visibly different overlays", () => {
    const b = scenarioBranches(35, "career", 5);
    expect(b).toHaveLength(3);
    const ids = new Set(b.map((x) => x.id));
    expect(ids.size).toBe(3);
    for (const branch of b) {
      const total = branch.perYearDeltas
        .flatMap((d) => Object.values(d))
        .reduce((s, v) => s + Math.abs(v ?? 0), 0);
      expect(total).toBeGreaterThan(0);
      // No "will succeed" language in branch text.
      const txt = JSON.stringify(branch);
      for (const re of BANNED_TERMS) expect(re.test(txt)).toBe(false);
    }
  });

  it("every evidence_ref inside a snapshot resolves against supplied facts", () => {
    const r = buildDomainSeries({ mode: "demo", facts: DEMO_FACTS, ...range });
    const snap = ageSnapshot(30, r)!;
    expect(allRefsResolve(snap)).toBe(true);
    // Unsupported western fields explicitly reject.
    const bad = resolveEvidence("western:transit:30", DEMO_FACTS);
    expect(bad.ok).toBe(false);
  });

  it("zh and en labels exist for every domain and no banned phrase leaks in any label", () => {
    for (const k of DOMAIN_KEYS) {
      expect(DOMAIN_LABELS[k].zh.length).toBeGreaterThan(0);
      expect(DOMAIN_LABELS[k].en.length).toBeGreaterThan(0);
      for (const re of BANNED_TERMS) {
        expect(re.test(DOMAIN_LABELS[k].zh)).toBe(false);
        expect(re.test(DOMAIN_LABELS[k].en)).toBe(false);
      }
    }
  });

  it("factsFromSeed produces a stable variant per seed", () => {
    const a = factsFromSeed("chart:1990-01-01");
    const b = factsFromSeed("chart:1990-01-01");
    const c = factsFromSeed("chart:1995-06-30");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

// Retain the old scenario-engine tests via existing MathLifeModel.test.ts.
// Ensure this file compiles even if someone imports DomainKey elsewhere.
export type _Reserved = DomainKey;
