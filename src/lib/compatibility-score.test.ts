import { describe, expect, it } from "vitest";

import {
  computeCompatibility,
  canonicalPairKey,
  COMPATIBILITY_SCORE_VERSION,
  type CompatInput,
} from "./compatibility-score";

const A = {
  userId: "user-aaa",
  chartId: "chart-a",
  facets: { yang: 0.6, pace: 0.7, openness: 0.6, rootedness: 0.5 },
};
const B = {
  userId: "user-bbb",
  chartId: "chart-b",
  facets: { yang: -0.4, pace: 0.6, openness: 0.55, rootedness: 0.7 },
};

describe("compatibility-score-v1", () => {
  it("emits stable version and pair key", () => {
    const r = computeCompatibility({ a: A, b: B });
    expect(r.version).toBe(COMPATIBILITY_SCORE_VERSION);
    expect(r.pairKey).toBe(canonicalPairKey(A.userId, B.userId));
    expect(r.pairKey).toBe(canonicalPairKey(B.userId, A.userId));
  });

  it("is order-independent (score(A,B) === score(B,A))", () => {
    const r1 = computeCompatibility({ a: A, b: B });
    const r2 = computeCompatibility({ a: B, b: A });
    expect(r2.overall).toBe(r1.overall);
    expect(r2.pairKey).toBe(r1.pairKey);
    expect(r2.dimensions.map((d) => d.score)).toEqual(
      r1.dimensions.map((d) => d.score),
    );
  });

  it("is deterministic across runs", () => {
    const r1 = computeCompatibility({ a: A, b: B });
    const r2 = computeCompatibility({ a: A, b: B });
    expect(r2).toEqual(r1);
  });

  it("defaults to friendship mode", () => {
    const r = computeCompatibility({ a: A, b: B });
    expect(r.mode).toBe("friendship");
  });

  it("always emits 5 named dimensions and disclaimer", () => {
    const r = computeCompatibility({ a: A, b: B });
    expect(r.dimensions.map((d) => d.key)).toEqual([
      "communication",
      "emotional_support",
      "action_rhythm",
      "boundary_repair",
      "shared_growth",
    ]);
    expect(r.disclaimer).toMatch(/互动适配指数/);
    expect(r.disclaimer).toMatch(/不代表关系成功率/);
  });

  it("returns non-empty resonance / complement / friction / suggestion arrays", () => {
    const r = computeCompatibility({ a: A, b: B });
    expect(r.resonances.length).toBeGreaterThan(0);
    expect(r.complements.length).toBeGreaterThan(0);
    expect(r.frictions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("marks partial=true when facets are missing", () => {
    const r = computeCompatibility({
      a: { ...A, facets: { yang: 0.2 } },
      b: { ...B, facets: {} },
    });
    expect(r.partial).toBe(true);
    expect(r.confidence).toBeLessThan(1);
  });

  it("gives full confidence when both sides supply all facets", () => {
    const r = computeCompatibility({ a: A, b: B });
    expect(r.partial).toBe(false);
    expect(r.confidence).toBe(1);
  });

  it("keeps scores in [0,100]", () => {
    const r = computeCompatibility({ a: A, b: B });
    for (const d of r.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it("mode changes only suggestion phrasing, not scores", () => {
    const rf = computeCompatibility({ a: A, b: B, mode: "friendship" });
    const rr = computeCompatibility({ a: A, b: B, mode: "romantic" });
    expect(rr.overall).toBe(rf.overall);
    expect(rr.suggestions).not.toEqual(rf.suggestions);
  });
});
