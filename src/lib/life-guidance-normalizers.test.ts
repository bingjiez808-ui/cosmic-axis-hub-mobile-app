// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import {
  clampCuratorPageIndex,
  curatorLetter,
  getCuratorPage,
  normalizeDomain,
  normalizeLang,
  normalizeLifeStage,
  normalizeOnboardingIntent,
} from "@/lib/life-guidance-v1";

describe("life-guidance normalizers", () => {
  test("normalizeLang covers zh/en/legacy/undefined without throwing", () => {
    expect(normalizeLang("zh")).toBe("zh");
    expect(normalizeLang("en")).toBe("en");
    expect(normalizeLang("zh-CN")).toBe("zh");
    expect(normalizeLang("zh_HK")).toBe("zh");
    expect(normalizeLang("cn")).toBe("zh");
    expect(normalizeLang("cmn-Hans")).toBe("zh");
    expect(normalizeLang("en-US")).toBe("en");
    expect(normalizeLang("EN-GB")).toBe("en");
    expect(normalizeLang(undefined)).toBe("zh");
    expect(normalizeLang(null)).toBe("zh");
    expect(normalizeLang(42)).toBe("zh");
    expect(normalizeLang("something-weird")).toBe("zh");
  });

  test("normalizeLifeStage rejects legacy / unknown values", () => {
    expect(normalizeLifeStage("building_life")).toBe("building_life");
    expect(normalizeLifeStage("legacy_stage")).toBeNull();
    expect(normalizeLifeStage(null)).toBeNull();
    expect(normalizeLifeStage(undefined)).toBeNull();
    expect(normalizeLifeStage(3)).toBeNull();
  });

  test("normalizeDomain and normalizeOnboardingIntent are safe", () => {
    expect(normalizeDomain("career")).toBe("career");
    expect(normalizeDomain("weird")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeOnboardingIntent("courage")).toBe("courage");
    expect(normalizeOnboardingIntent("legacy")).toBeNull();
    expect(normalizeOnboardingIntent(undefined)).toBeNull();
  });

  test("clampCuratorPageIndex clamps 0, 5, NaN, negatives", () => {
    expect(clampCuratorPageIndex(0)).toBe(1);
    expect(clampCuratorPageIndex(-2)).toBe(1);
    expect(clampCuratorPageIndex(5)).toBe(4);
    expect(clampCuratorPageIndex(Number.NaN)).toBe(1);
    expect(clampCuratorPageIndex("2")).toBe(2);
    expect(clampCuratorPageIndex(undefined)).toBe(1);
  });

  test("getCuratorPage never returns undefined", () => {
    for (const bad of [-1, 0, 5, 99, Number.NaN, "x", undefined]) {
      const p = getCuratorPage("zh-CN", bad);
      expect(typeof p.title).toBe("string");
      expect(p.title.length).toBeGreaterThan(0);
    }
    const p = getCuratorPage("en", 3);
    expect(p).toBe(curatorLetter.en.pages[2]);
  });
});
