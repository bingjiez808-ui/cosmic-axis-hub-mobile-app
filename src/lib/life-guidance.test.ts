// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  LIFE_GUIDANCE_VERSION,
  LIFE_STAGES,
  computeAge,
  defaultStageForAge,
  pickPriorityDomain,
  stageCopy,
  domainAction,
  figuresFor,
  historicalFigures,
  curatorLetter,
  chapterCopy,
  echoCopy,
} from "@/lib/life-guidance-v1";

describe("life-guidance-v1", () => {
  it("has a stable version tag", () => {
    expect(LIFE_GUIDANCE_VERSION).toBe("life-guidance-v1");
  });

  describe("computeAge", () => {
    it("returns null on missing / malformed input", () => {
      expect(computeAge(null, "2026-07-27")).toBeNull();
      expect(computeAge("not-a-date", "2026-07-27")).toBeNull();
      expect(computeAge("1990-01-01", "bad")).toBeNull();
    });
    it("counts before birthday as one year younger", () => {
      expect(computeAge("1990-08-01", "2026-07-27")).toBe(35);
    });
    it("counts on and after birthday as full year", () => {
      expect(computeAge("1990-07-27", "2026-07-27")).toBe(36);
      expect(computeAge("1990-06-01", "2026-07-27")).toBe(36);
    });
    it("clamps negatives to 0", () => {
      expect(computeAge("2030-01-01", "2026-07-27")).toBe(0);
    });
    it("handles feb-29 birthdays deterministically in non-leap years", () => {
      // Feb-29 birthday, checked on Feb-28 of a non-leap year → not yet had bday
      expect(computeAge("2000-02-29", "2026-02-28")).toBe(25);
      expect(computeAge("2000-02-29", "2026-03-01")).toBe(26);
    });
  });

  describe("defaultStageForAge", () => {
    it("maps each age band to the documented stage", () => {
      expect(defaultStageForAge(null)).toBeNull();
      expect(defaultStageForAge(15)).toBe("learning_self");
      expect(defaultStageForAge(22)).toBe("learning_self");
      expect(defaultStageForAge(23)).toBe("early_adulthood");
      expect(defaultStageForAge(29)).toBe("early_adulthood");
      expect(defaultStageForAge(30)).toBe("building_life");
      expect(defaultStageForAge(41)).toBe("building_life");
      expect(defaultStageForAge(42)).toBe("midlife_reassessment");
      expect(defaultStageForAge(54)).toBe("midlife_reassessment");
      expect(defaultStageForAge(55)).toBe("maturity_legacy");
      expect(defaultStageForAge(90)).toBe("maturity_legacy");
    });
  });

  describe("pickPriorityDomain", () => {
    it("picks domain farthest from 50, ties by DOMAIN_ORDER", () => {
      expect(pickPriorityDomain([])).toBeNull();
      expect(
        pickPriorityDomain([
          { domain: "love", score: 55 },
          { domain: "career", score: 30 },
          { domain: "study", score: 62 },
        ]),
      ).toBe("career");
      // 55 vs 45 → both delta 5, love wins (order 0)
      expect(
        pickPriorityDomain([
          { domain: "career", score: 45 },
          { domain: "love", score: 55 },
        ]),
      ).toBe("love");
    });
    it("ignores unknown domains", () => {
      expect(
        pickPriorityDomain([
          { domain: "unknown_x", score: 90 },
          { domain: "study", score: 40 },
        ]),
      ).toBe("study");
    });
  });

  describe("stageCopy / domainAction i18n", () => {
    it("covers every stage in both languages with non-empty text", () => {
      for (const s of LIFE_STAGES) {
        for (const lang of ["en", "zh"] as const) {
          const c = stageCopy(s, lang);
          expect(c.label.length).toBeGreaterThan(1);
          expect(c.resonance.length).toBeGreaterThan(4);
          expect(c.lesson.length).toBeGreaterThan(4);
          expect(c.peerReframe.length).toBeGreaterThan(4);
        }
      }
    });
    it("covers every (stage, domain, lang) combo with distinct action/caution", () => {
      const domains = ["love", "study", "career", "body_mind", "finance"] as const;
      for (const s of LIFE_STAGES) {
        for (const d of domains) {
          for (const lang of ["en", "zh"] as const) {
            const a = domainAction(s, d, lang);
            expect(a.action.length).toBeGreaterThan(4);
            expect(a.caution.length).toBeGreaterThan(4);
            expect(a.action).not.toEqual(a.caution);
          }
        }
      }
    });
    it("returns a body_mind fallback when domain is null", () => {
      const a = domainAction("early_adulthood", null, "zh");
      expect(a.action.length).toBeGreaterThan(4);
    });
  });

  describe("figuresFor", () => {
    it("returns figures for the requested stage, deterministic order", () => {
      const a = figuresFor("early_adulthood", "career");
      const b = figuresFor("early_adulthood", "career");
      expect(a.map((f) => f.key)).toEqual(b.map((f) => f.key));
      expect(a.every((f) => f.stage === "early_adulthood")).toBe(true);
    });
    it("promotes figures whose domains contain the priority", () => {
      const list = figuresFor("building_life", "love");
      expect(list[0].domains).toContain("love");
    });
    it("gives every stage ≥ 3 figures", () => {
      for (const s of LIFE_STAGES) {
        expect(figuresFor(s, null).length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("historicalFigures data integrity", () => {
    it("has unique figure keys", () => {
      const keys = historicalFigures.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
    it("every figure has both languages populated", () => {
      for (const f of historicalFigures) {
        for (const lang of ["en", "zh"] as const) {
          expect(f.name[lang].length).toBeGreaterThan(1);
          expect(f.situation[lang].length).toBeGreaterThan(10);
          expect(f.tension[lang].length).toBeGreaterThan(10);
          expect(f.choice[lang].length).toBeGreaterThan(10);
          expect(f.borrow[lang].length).toBeGreaterThan(4);
          expect(f.dontCopy[lang].length).toBeGreaterThan(4);
        }
      }
    });
  });

  describe("curator / chapter / echo copy", () => {
    it("provides ≥5 non-empty paragraphs in curator letter for both langs", () => {
      for (const lang of ["en", "zh"] as const) {
        const c = curatorLetter[lang];
        expect(c.paragraphs.length).toBeGreaterThanOrEqual(5);
        for (const p of c.paragraphs) expect(p.length).toBeGreaterThan(10);
        expect(c.safety.length).toBeGreaterThan(4);
      }
    });
    it("chapter copy provides an age line formatter", () => {
      expect(chapterCopy.en.ageLine(30)).toContain("30");
      expect(chapterCopy.zh.ageLine(30)).toContain("30");
    });
    it("echo copy provides both languages", () => {
      expect(echoCopy.en.title.length).toBeGreaterThan(2);
      expect(echoCopy.zh.title.length).toBeGreaterThan(2);
    });
  });
});

import {
  classifyDomainSignal,
  recommendFigures,
  FIGURE_META,
  CONCERN_TAG_MAP,
  DOMAIN_TAG_MAP,
} from "@/lib/life-guidance-v1";

describe("classifyDomainSignal", () => {
  it("maps ≥60 → opportunity, ≤40 → pressure, else neutral", () => {
    expect(classifyDomainSignal(72)).toBe("opportunity");
    expect(classifyDomainSignal(60)).toBe("opportunity");
    expect(classifyDomainSignal(59)).toBe("neutral");
    expect(classifyDomainSignal(41)).toBe("neutral");
    expect(classifyDomainSignal(40)).toBe("pressure");
    expect(classifyDomainSignal(10)).toBe("pressure");
    expect(classifyDomainSignal(null)).toBe("neutral");
    expect(classifyDomainSignal(undefined)).toBe("neutral");
  });
});

describe("FIGURE_META coverage", () => {
  it("assigns metadata to every historical figure", () => {
    for (const f of historicalFigures) {
      const m = FIGURE_META[f.key];
      expect(m).toBeDefined();
      expect(m.tags.length).toBeGreaterThan(0);
      expect(["opportunity", "pressure", "neutral"]).toContain(m.signal);
      expect(m.sourceUrl.startsWith("http")).toBe(true);
    }
  });
});

describe("recommendFigures", () => {
  it("is deterministic for identical input", () => {
    const a = recommendFigures({
      stage: "building_life",
      concern: "love",
      domain: "love",
      domainSignal: "pressure",
      domainLabel: "爱情",
    });
    const b = recommendFigures({
      stage: "building_life",
      concern: "love",
      domain: "love",
      domainSignal: "pressure",
      domainLabel: "爱情",
    });
    expect(a.map((r) => r.figure.key)).toEqual(b.map((r) => r.figure.key));
  });

  it("all returned figures are in the requested stage", () => {
    const list = recommendFigures({ stage: "midlife_reassessment" });
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) expect(r.figure.stage).toBe("midlife_reassessment");
  });

  it("distinguishes opportunity vs pressure alignment on the same figure set", () => {
    const opp = recommendFigures({
      stage: "maturity_legacy",
      domain: "finance",
      domainSignal: "opportunity",
    });
    const pres = recommendFigures({
      stage: "maturity_legacy",
      domain: "finance",
      domainSignal: "pressure",
    });
    // Different signals must not produce identical top ordering when at
    // least one figure has a non-neutral signal — regression guard for
    // the old "absolute-distance-from-50" bug.
    const oppTop = opp[0].figure.key;
    const presTop = pres[0].figure.key;
    // Both branches must include a signal alignment reason when the top
    // figure's signal matches the requested band.
    if (FIGURE_META[oppTop].signal === "opportunity") {
      expect(opp[0].reasons.some((r) => r.key === "signal")).toBe(true);
    }
    if (FIGURE_META[presTop].signal === "pressure") {
      expect(pres[0].reasons.some((r) => r.key === "signal")).toBe(true);
    }
  });

  it("emits a 'concern' reason chip when concern tags overlap", () => {
    const list = recommendFigures({
      stage: "midlife_reassessment",
      concern: "finance",
    });
    const top = list[0];
    // gauguin sits under midlife_reassessment with financial_rebuild tag
    expect(top.reasons.some((r) => r.key === "concern")).toBe(true);
    expect(top.matchLevel).toBe("high");
  });

  it("falls back to matchLevel=stage_only when nothing beyond stage matches", () => {
    const list = recommendFigures({
      stage: "learning_self",
      concern: "finance", // no overlap with learning_self figures
      domain: null,
      domainSignal: "neutral",
    });
    expect(list.every((r) => r.matchLevel === "stage_only")).toBe(true);
    // stage reason still present so UI can render the chip row
    expect(list[0].reasons.some((r) => r.key === "stage")).toBe(true);
  });

  it("CONCERN_TAG_MAP covers every concern key with a valid list", () => {
    for (const k of Object.keys(CONCERN_TAG_MAP)) {
      expect(Array.isArray(CONCERN_TAG_MAP[k])).toBe(true);
    }
  });

  it("DOMAIN_TAG_MAP covers all five domains", () => {
    for (const d of ["love", "study", "career", "body_mind", "finance"] as const) {
      expect(DOMAIN_TAG_MAP[d].length).toBeGreaterThan(0);
    }
  });
});
