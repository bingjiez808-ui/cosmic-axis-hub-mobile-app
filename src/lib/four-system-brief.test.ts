import { describe, expect, test } from "vitest";

import { buildCalculationSnapshot } from "./calc-snapshot";
import {
  buildFourSystemFacts,
  concernFocusDirective,
  coverageDirective,
  crossSystemDirective,
  systemCoverageFromFacts,
} from "./four-system-brief";
import { CONCERN_READING_GUIDES } from "./concern-reading-guide";
import { CONCERN_KEYS } from "./concern-guidance-v1";

const FULL = buildCalculationSnapshot({
  date: "2002-11-03",
  time: "09:26",
  place: "Nanjing",
  lang: "zh",
  gender: "female",
});

describe("buildFourSystemFacts", () => {
  test("complete birth data yields all four systems", () => {
    const f = buildFourSystemFacts(FULL);
    expect(f.complete).toBe(true);
    expect(f.missing).toEqual([]);
    expect(f.vedic).toContain("Hasta");
    expect(f.ziwei).toContain("命宫");
  });

  test("missing gender blocks ziwei and is reported, not invented", () => {
    const snap = buildCalculationSnapshot({
      date: "2002-11-03", time: "09:26", place: "Nanjing", lang: "zh",
    });
    const f = buildFourSystemFacts(snap);
    expect(f.complete).toBe(false);
    expect(f.missing).toContain("ziwei");
    expect(f.ziwei).toBeUndefined();
  });
});

describe("systemCoverageFromFacts (server view)", () => {
  test("detects all four from prompt strings", () => {
    const r = systemCoverageFromFacts({
      planets: [{ name: "Sun", sign: "Scorpio" }],
      bazi: "壬午 庚戌 癸酉 丁巳",
      vedic: "Moon Hasta pada 4",
      ziwei: "命宫紫微·七杀",
    });
    expect(r.complete).toBe(true);
  });
  test("flags empties", () => {
    const r = systemCoverageFromFacts({ planets: [], bazi: "", vedic: null, ziwei: "  " });
    expect(r.missing.sort()).toEqual(["bazi", "vedic", "western", "ziwei"]);
  });
});

describe("prompt directives", () => {
  test("coverage directive names missing systems and forbids fabrication", () => {
    const zh = coverageDirective(["ziwei"], "zh");
    expect(zh).toContain("紫微斗数");
    expect(zh).toContain("虚构");
    const en = coverageDirective([], "en");
    expect(en).toContain("all four systems");
  });

  test("cross-system directive demands convergence + tension in both languages", () => {
    expect(crossSystemDirective("zh")).toContain("共振");
    expect(crossSystemDirective("zh")).toContain("单体系参考");
    expect(crossSystemDirective("en")).toContain("converge");
  });

  test("concern directive injects all three '会帮你分清' cards", () => {
    for (const key of CONCERN_KEYS) {
      const zh = concernFocusDirective(key, "zh");
      const en = concernFocusDirective(key, "en");
      for (const card of CONCERN_READING_GUIDES[key].readingIndexes) {
        expect(zh).toContain(card.title.zh);
        expect(en).toContain(card.title.en);
      }
    }
  });

  test("unknown concern is a no-op", () => {
    expect(concernFocusDirective(undefined, "zh")).toBe("");
    expect(concernFocusDirective("nope", "en")).toBe("");
  });
});
