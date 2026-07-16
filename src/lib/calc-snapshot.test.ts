/**
 * Calculation snapshot + consistency validator tests.
 *
 * Anchors on serena, 2002-11-03 09:26 Nanjing → tropical Sun in Scorpio
 * (water). BaZi is checked to produce four pillars via lunar-javascript
 * and a valid day-master stem/element. Vedic and Zi Wei remain marked
 * "unavailable" so the paid deep-report can never be minted while any
 * calculator is missing.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import {
  buildCalculationSnapshot,
  CALCULATION_VERSION,
  elementForSign,
  missingSystems,
  tropicalSunSignFromDate,
  validateEvidenceAgainstSnapshot,
} from "./calc-snapshot";

describe("tropicalSunSignFromDate", () => {
  test("2002-11-03 → Scorpio (idx 7, water)", () => {
    const s = tropicalSunSignFromDate("2002-11-03");
    expect(s).toBe(7);
    expect(elementForSign(s!)).toBe("water");
  });
  test("boundary: 2002-11-22 → Sagittarius", () => {
    expect(tropicalSunSignFromDate("2002-11-22")).toBe(8);
  });
  test("boundary: 2002-10-23 → Scorpio", () => {
    expect(tropicalSunSignFromDate("2002-10-23")).toBe(7);
  });
  test("invalid input → null", () => {
    expect(tropicalSunSignFromDate("")).toBeNull();
    expect(tropicalSunSignFromDate("not-a-date")).toBeNull();
  });
});

describe("buildCalculationSnapshot", () => {
  const snap = buildCalculationSnapshot({
    date: "2002-11-03",
    time: "09:26",
    place: "Nanjing",
    lang: "zh",
  });

  test("stamps version + generated_at", () => {
    expect(snap.calculation_version).toBe(CALCULATION_VERSION);
    expect(typeof snap.generated_at).toBe("string");
  });

  test("western: Sun in Scorpio, water element, ok", () => {
    expect(snap.western.status).toBe("ok");
    expect(snap.western.sun?.sign_zh).toBe("天蝎");
    expect(snap.western.sun?.element).toBe("water");
  });

  test("bazi: real four pillars via lunar-javascript, day-master stem present", () => {
    expect(snap.bazi.status).toBe("ok");
    expect(snap.bazi.pillars?.day).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(snap.bazi.day_master?.stem).toBe(snap.bazi.pillars!.day.charAt(0));
    expect(snap.bazi.day_master?.element).toBeDefined();
  });

  test("vedic + ziwei always unavailable — no calculator wired", () => {
    expect(snap.vedic.status).toBe("unavailable");
    expect(snap.ziwei.status).toBe("unavailable");
  });

  test("missingSystems flags vedic + ziwei so paid gate blocks", () => {
    expect(missingSystems(snap).sort()).toEqual(["vedic", "ziwei"]);
  });

  test("missing date → western + bazi also unavailable", () => {
    const empty = buildCalculationSnapshot({});
    expect(empty.western.status).toBe("unavailable");
    expect(empty.bazi.status).toBe("unavailable");
    expect(missingSystems(empty).sort()).toEqual(["bazi", "vedic", "western", "ziwei"]);
  });
});

describe("validateEvidenceAgainstSnapshot", () => {
  const snap = buildCalculationSnapshot({ date: "2002-11-03", time: "09:26", lang: "zh" });

  test("flags '太阳落火象' contradiction against Scorpio (water)", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "西方占星", note: "太阳落火象 · 水星逆行于第三宫" },
    ]);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe("sun_element_mismatch");
  });

  test("accepts a correct water-element Sun claim", () => {
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "西方占星", note: "太阳落天蝎 · 水象 · 情感深、蜕变型" },
    ]);
    expect(issues.filter((i) => i.code === "sun_element_mismatch")).toEqual([]);
  });

  test("flags mismatched day-master stem", () => {
    const wrongStem = "甲乙丙丁戊己庚辛壬癸".split("").find((s) => s !== snap.bazi.day_master!.stem)!;
    const issues = validateEvidenceAgainstSnapshot(snap, [
      { tradition: "八字", note: `日主 ${wrongStem} · 十神显发` },
    ]);
    expect(issues.some((i) => i.code === "day_master_mismatch")).toBe(true);
  });
});
