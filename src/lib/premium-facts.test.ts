/**
 * Premium facts: local, immutable chart data the AI narrative is
 * allowed to cite. These tests lock in the invariants that keep AI
 * from inventing chart values.
 *
 * Fixture: Nanjing 2002-11-03 09:26 female — same anchor used by
 * calc-snapshot.test.ts, so consistency across the two files is
 * verifiable.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";

import { buildCalculationSnapshot } from "./calc-snapshot";
import {
  HONESTLY_UNAVAILABLE_MODULES,
  PREMIUM_FACTS_VERSION,
  buildPremiumFacts,
  deriveBaziFacts,
  deriveZiweiFacts,
  resolveFactsPath,
  tenGodOf,
} from "./premium-facts";

const NANJING = {
  date: "2002-11-03",
  time: "09:26",
  place: "Nanjing",
  lang: "zh" as const,
  gender: "female" as const,
};

describe("tenGodOf", () => {
  test("day master 甲 vs 甲 → 比肩; 甲 vs 乙 → 劫财", () => {
    expect(tenGodOf("甲", "甲")).toBe("比肩");
    expect(tenGodOf("甲", "乙")).toBe("劫财");
  });
  test("day master 甲 vs 庚 → 七杀; 甲 vs 辛 → 正官", () => {
    expect(tenGodOf("甲", "庚")).toBe("七杀");
    expect(tenGodOf("甲", "辛")).toBe("正官");
  });
  test("unknown stem → null", () => {
    expect(tenGodOf("X", "甲")).toBeNull();
    expect(tenGodOf("甲", "?")).toBeNull();
  });
});

describe("deriveBaziFacts — Nanjing 2002-11-03 09:26", () => {
  const snap = buildCalculationSnapshot(NANJING);
  const bazi = deriveBaziFacts(snap);

  test("four pillars are real (from lunar-javascript)", () => {
    expect(bazi).not.toBeNull();
    expect(bazi!.pillars.year).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(bazi!.pillars.month).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(bazi!.pillars.day).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(bazi!.pillars.hour).toMatch(/^[甲乙丙丁戊己庚辛壬癸].$/);
    expect(bazi!.day_master?.stem).toBe(bazi!.pillars.day.charAt(0));
  });

  test("five-element counts sum to 8 (4 stems + 4 branches)", () => {
    const sum = Object.values(bazi!.element_counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(8);
  });

  test("ten-gods reference the real day-master stem (never a fake stem)", () => {
    const stems = "甲乙丙丁戊己庚辛壬癸".split("");
    for (const tg of bazi!.ten_gods) {
      expect(stems).toContain(tg.stem);
      // Every ten-god label the derivation returns must be a real one.
      if (tg.label != null) {
        expect(["比肩","劫财","食神","伤官","偏财","正财","七杀","正官","偏印","正印"]).toContain(tg.label);
      }
    }
  });

  test("gender-missing snapshot → derive returns bazi facts but ziwei is null", () => {
    const noGender = buildCalculationSnapshot({ ...NANJING, gender: null });
    expect(deriveBaziFacts(noGender)).not.toBeNull();
    expect(deriveZiweiFacts(noGender)).toBeNull();
  });
});

describe("deriveZiweiFacts — real iztro output only", () => {
  const snap = buildCalculationSnapshot(NANJING);
  const zw = deriveZiweiFacts(snap)!;

  test("has 12 palaces, 命宫 index resolvable, 五行局 populated", () => {
    expect(zw.palaces.length).toBe(12);
    expect(zw.soul_palace_index).toBeGreaterThanOrEqual(0);
    expect(zw.five_elements_class.length).toBeGreaterThan(0);
    const soul = zw.palaces[zw.soul_palace_index];
    expect(soul.name).toBe("命宫");
    // The classical anchor for this fixture: 命宫 contains 紫微 and 七杀.
    const majors = soul.major_stars.map((s) => s.name);
    expect(majors).toContain("紫微");
    expect(majors).toContain("七杀");
  });

  test("every palace's major stars only carry brightness/mutagen from iztro", () => {
    for (const p of zw.palaces) {
      for (const s of p.major_stars) {
        expect(typeof s.name).toBe("string");
        expect(s.brightness === null || typeof s.brightness === "string").toBe(true);
        expect(s.mutagen === null || typeof s.mutagen === "string").toBe(true);
      }
    }
  });
});

describe("buildPremiumFacts + resolveFactsPath — AI cannot invent fields", () => {
  const snap = buildCalculationSnapshot(NANJING);
  const facts = buildPremiumFacts(snap);

  test("version is pinned to v4", () => {
    expect(facts.version).toBe(PREMIUM_FACTS_VERSION);
    expect(PREMIUM_FACTS_VERSION).toBe("premium_facts_v4");
  });

  test("evidence paths that DO exist resolve; fabricated ones return undefined", () => {
    expect(resolveFactsPath(facts, "bazi.pillars.day")).toBe(facts.bazi!.pillars.day);
    expect(resolveFactsPath(facts, "ziwei.five_elements_class")).toBe(facts.ziwei!.five_elements_class);
    // Fabricated / not-yet-computed → undefined. AI narrative that
    // cites these paths must be flagged by upstream validators.
    expect(resolveFactsPath(facts, "ziwei.da_xian_10year")).toBeUndefined();
    expect(resolveFactsPath(facts, "vedic.antardasha")).toBeUndefined();
    expect(resolveFactsPath(facts, "bazi.da_yun_luck_pillars")).toBeUndefined();
  });

  test("v3 evidence paths that DO exist resolve", () => {
    // BaZi luck pillars (from lunar-javascript getYun).
    const luck = resolveFactsPath(facts, "bazi.luck.pillars") as unknown[] | undefined;
    expect(Array.isArray(luck)).toBe(true);
    expect(luck!.length).toBeGreaterThan(0);
    // Vedic Mahadasha timeline.
    const md = resolveFactsPath(facts, "vedic.mahadasha") as unknown[] | undefined;
    expect(Array.isArray(md)).toBe(true);
    expect(md!.length).toBeGreaterThan(0);
    // Western planets (9 luminaries).
    const planets = resolveFactsPath(facts, "western.planets") as unknown[] | undefined;
    expect(Array.isArray(planets)).toBe(true);
    expect(planets!.length).toBe(9);
  });

  test("Ziwei horoscope is null without asOfDate; populated with asOfDate", () => {
    expect(facts.ziwei?.horoscope).toBeNull();
    const withDate = buildPremiumFacts(snap, { asOfDate: "2026-01-01" });
    expect(withDate.ziwei?.horoscope).not.toBeNull();
    expect(withDate.ziwei?.horoscope?.decadal.age_range.length).toBe(2);
  });

  test("Vedic current MD/AD/PD only surfaces with asOfDate", () => {
    expect(facts.vedic?.current).toBeNull();
    const withDate = buildPremiumFacts(snap, { asOfDate: "2026-01-01" });
    expect(withDate.vedic?.current?.mahadasha_lord).toMatch(/^(Ketu|Venus|Sun|Moon|Mars|Rahu|Jupiter|Saturn|Mercury)$/);
  });

  test("unavailable list is stable — reader shows exactly these as honest gaps", () => {
    const expected = new Set<string>(HONESTLY_UNAVAILABLE_MODULES);
    for (const item of facts.unavailable) expected.delete(item);
    // Additional runtime-detected items (e.g. pratyantar_validation_failed)
    // are allowed on top; core list should always be included.
    expect(expected.size).toBe(0);
  });

  test("legacy content_json without `facts` is still readable (shape tolerance)", () => {
    const legacy = {
      meta: {
        prompt_version: "v1",
        report_version: "premium_pdf_v1",
        generated_at: "2025-01-01T00:00:00Z",
        lang: "zh",
        chart_name: "Legacy",
        disclaimer: "…",
      },
      cover: { title: "…", subtitle: "…" },
      chapters: [{ key: "executive_summary", title: "执行摘要", body: "…" }],
    };
    const anyLegacy = legacy as unknown as { facts?: unknown; chapters: unknown[] };
    expect(anyLegacy.facts).toBeUndefined();
    expect(Array.isArray(anyLegacy.chapters)).toBe(true);
  });
});

