// @ts-expect-error — bun:test
import { describe, expect, test as it } from "bun:test";

import { BOOKMARKS, ageDomainVariance, recommendBookmark } from "./LifeMathBookmarks";

describe("LifeMathBookmarks", () => {
  it("ships exactly eight fixed bookmarks with bilingual copy", () => {
    expect(BOOKMARKS).toHaveLength(8);
    const ids = new Set(BOOKMARKS.map((b) => b.id));
    expect(ids.size).toBe(8);
    for (const b of BOOKMARKS) {
      expect(b.concept.zh.length).toBeGreaterThan(0);
      expect(b.concept.en.length).toBeGreaterThan(0);
      expect(b.translation.zh.length).toBeGreaterThan(4);
      expect(b.translation.en.length).toBeGreaterThan(4);
      expect(b.action.zh.length).toBeGreaterThan(4);
      expect(b.action.en.length).toBeGreaterThan(4);
    }
  });

  it("multi-branch comparison prioritises opportunity-cost", () => {
    const r = recommendBookmark({ activeBranchCount: 3, ageVarianceHigh: false, wealthRiskScore: 50, studyOrLongTerm: false });
    expect(r.id).toBe("opportunity-cost");
    expect(r.reason.zh).toContain("3");
  });

  it("single branch comparison recommends bayes", () => {
    const r = recommendBookmark({ activeBranchCount: 1, ageVarianceHigh: false, wealthRiskScore: 50, studyOrLongTerm: false });
    expect(r.id).toBe("bayes");
  });

  it("high wealth-risk exposure recommends survivorship", () => {
    const r = recommendBookmark({ activeBranchCount: 0, ageVarianceHigh: false, wealthRiskScore: 75, studyOrLongTerm: false });
    expect(r.id).toBe("survivorship");
  });

  it("low wealth-risk headroom recommends murphy buffer", () => {
    const r = recommendBookmark({ activeBranchCount: 0, ageVarianceHigh: false, wealthRiskScore: 30, studyOrLongTerm: false });
    expect(r.id).toBe("murphy");
  });

  it("high age variance recommends simpson", () => {
    const r = recommendBookmark({ activeBranchCount: 0, ageVarianceHigh: true, wealthRiskScore: 50, studyOrLongTerm: false });
    expect(r.id).toBe("simpson");
  });

  it("long-term / study phase recommends compounding", () => {
    const r = recommendBookmark({ activeBranchCount: 0, ageVarianceHigh: false, wealthRiskScore: 50, studyOrLongTerm: true });
    expect(r.id).toBe("compounding");
  });

  it("with no strong signal, falls back to regression-to-mean", () => {
    const r = recommendBookmark({ activeBranchCount: 0, ageVarianceHigh: false, wealthRiskScore: 50, studyOrLongTerm: false });
    expect(r.id).toBe("regression-to-mean");
  });

  it("recommendation is deterministic across repeated calls", () => {
    const a = recommendBookmark({ activeBranchCount: 2, ageVarianceHigh: true, wealthRiskScore: 70, studyOrLongTerm: true });
    const b = recommendBookmark({ activeBranchCount: 2, ageVarianceHigh: true, wealthRiskScore: 70, studyOrLongTerm: true });
    expect(a.id).toBe(b.id);
  });

  it("ageDomainVariance is 0 for flat scores and positive otherwise", () => {
    expect(ageDomainVariance({
      study: 50, career: 50, love: 50, family: 50, social: 50, wealthRisk: 50, health: 50,
    })).toBe(0);
    expect(ageDomainVariance({
      study: 20, career: 80, love: 50, family: 50, social: 50, wealthRisk: 50, health: 50,
    })).toBeGreaterThan(0);
  });

  it("bookmark translations avoid deterministic-fate language (guards may negate it)", () => {
    const banned = [/一定成功/, /必赚/, /稳赚/, /guaranteed to (succeed|profit)/i];
    for (const b of BOOKMARKS) {
      // Guard text may quote-and-reject a banned phrase, so exclude it.
      const blob = JSON.stringify([b.translation, b.action]);
      for (const re of banned) expect(re.test(blob)).toBe(false);
    }
  });
});
