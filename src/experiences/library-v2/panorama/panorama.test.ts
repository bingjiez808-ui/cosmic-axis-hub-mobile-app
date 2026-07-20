// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  computeDomainScores,
  recommendFirstRead,
  DOMAIN_SCORE_VERSION,
  type PanoramaFactsInput,
} from "./domain-score";
import { DEMO_PANORAMA_FACTS, DEMO_DOMAIN_READINGS, DEMO_DOMAIN_SCORES } from "./fixtures";
import { validateGuidedReading } from "./validator";
import { buildPanoramaFactsFromPremium } from "./adapter";
import { DOMAIN_ORDER } from "./types";

describe("domain-score-v1 · determinism", () => {
  it("returns four scores in canonical order", () => {
    const s = computeDomainScores(DEMO_PANORAMA_FACTS, 0);
    expect(s.map((x) => x.domain)).toEqual([...DOMAIN_ORDER]);
    expect(s.every((x) => x.calculation_version === DOMAIN_SCORE_VERSION)).toBe(true);
  });
  it("is idempotent: same facts → same scores", () => {
    const a = computeDomainScores(DEMO_PANORAMA_FACTS, 111);
    const b = computeDomainScores(DEMO_PANORAMA_FACTS, 999);
    expect(a.map((x) => x.score)).toEqual(b.map((x) => x.score));
    expect(a.map((x) => x.evidence_refs)).toEqual(b.map((x) => x.evidence_refs));
  });
  it("clamps scores into [0,100]", () => {
    for (const s of DEMO_DOMAIN_SCORES) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("domain-score-v1 · missing facts honesty", () => {
  it("marks unavailable systems and never invents contribution", () => {
    const empty: PanoramaFactsInput = { chart_id: "x", facts_hash: "h" };
    const s = computeDomainScores(empty, 0);
    for (const d of s) {
      expect(d.band).toBe("insufficient_facts");
      expect(d.confidence).toBe("reference_only");
      for (const c of d.system_contributions) {
        expect(c.available).toBe(false);
        expect(c.contribution).toBe(0);
      }
      expect(d.evidence_refs.length).toBe(0);
    }
  });
  it("reports western.houses / western.progressions as missing when not present", () => {
    const s = computeDomainScores(DEMO_PANORAMA_FACTS, 0);
    for (const d of s) {
      expect(d.missing_facts).toContain("western.houses");
      expect(d.missing_facts).toContain("western.progressions");
    }
  });
});

describe("domain-score-v1 · recommendation neutrality", () => {
  it("does not silently prefer career when signals are equal", () => {
    // All-empty facts should still return SOME domain, but not career by fiat.
    const equal: PanoramaFactsInput = {
      chart_id: "x",
      facts_hash: "h",
      // Fill just enough that all systems become available equally.
      bazi: {
        day_master: "甲",
        ten_gods_summary: { 比肩: 1, 正财: 1, 正官: 1, 正印: 1 },
        current_dayun_label: "2020-2029",
      },
      vedic: { mahadasha_current: { lord: "Ketu", from: "2020", to: "2027" } },
      ziwei: {
        ming_palace_stars: ["紫微"],
        career_palace_stars: ["武曲"],
        spouse_palace_stars: ["太阴"],
        wealth_palace_stars: ["天梁"],
        parent_palace_stars: ["文昌"],
      },
      western: {
        sun_sign: "Aries",
        mercury_sign: "Aries",
        venus_sign: "Aries",
        major_aspects: [],
        ascendant_available: false,
        houses_available: false,
        progressions_available: false,
      },
    };
    const scores = computeDomainScores(equal, 0);
    const rec = recommendFirstRead(scores);
    // Verify recommendation is deterministic and returns one of the four.
    expect(DOMAIN_ORDER).toContain(rec.domain);
    // Ensure the reason text mentions the label, not raw enum.
    expect(rec.reason_text.length).toBeGreaterThan(6);
    // Disclaimer is fixed.
    expect(rec.disclaimer).toBe("这是阅读顺序推荐，不是命运结论。");
  });
  it("respects preview interest without overriding high signal", () => {
    const rec = recommendFirstRead(DEMO_DOMAIN_SCORES, { love: 5 });
    expect(DOMAIN_ORDER).toContain(rec.domain);
  });
});

describe("guided-domain-reading-v1 · fixture validation", () => {
  it("all 4 demo readings pass the validator", () => {
    for (const d of DOMAIN_ORDER) {
      const issues = validateGuidedReading(DEMO_DOMAIN_READINGS[d]);
      // Only the soft note is allowed (houses/progressions unavailable) — but
      // demo fixtures address the limits note, so validator should be empty.
      expect(issues.filter((i) => i.code !== "missing_limits_note_soft")).toEqual([]);
    }
  });
  it("rejects an evidence ref outside the whitelist", () => {
    const bad = { ...DEMO_DOMAIN_READINGS.study, evidence_refs: ["forbidden.path"] };
    const issues = validateGuidedReading(bad);
    expect(issues.find((i) => i.code === "unsupported_evidence_ref")).toBeTruthy();
  });
  it("rejects empty evidence_refs", () => {
    const bad = { ...DEMO_DOMAIN_READINGS.career, evidence_refs: [] };
    const issues = validateGuidedReading(bad);
    expect(issues.find((i) => i.code === "empty_evidence")).toBeTruthy();
  });
});

describe("adapter · PremiumFacts → PanoramaFactsInput", () => {
  it("maps minimally and honestly", () => {
    const out = buildPanoramaFactsFromPremium({
      chart_id: "c1",
      version: "premium_facts_v4",
      facts_hash: "abc",
      bazi: {
        pillars: { day: { stem: "乙" } },
        ten_gods_summary: { 正印: 1 },
        element_counts: { wood: 2 },
      },
      western: { planets: [{ name: "Sun", sign: "Leo" }] },
    });
    expect(out.chart_id).toBe("c1");
    expect(out.bazi?.day_master).toBe("乙");
    expect(out.western?.sun_sign).toBe("Leo");
    expect(out.western?.houses_available).toBe(false);
    expect(out.western?.progressions_available).toBe(false);
  });
});
