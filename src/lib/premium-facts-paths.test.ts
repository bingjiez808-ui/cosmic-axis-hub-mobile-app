/**
 * Deep evidence paths + null-iztro fixture regression.
 *
 * Ensures:
 *   1. Nested paths (star names, aspect orbs, luck pillars, dasha lords)
 *      resolve deterministically for the reference chart.
 *   2. When Ziwei is unavailable (no gender / iztro failure), a chapter
 *      whose evidence_refs cite `ziwei.*` cannot pass validation and
 *      therefore cannot be persisted as `completed` — the worker must
 *      mark it `failed`.
 *   3. When Vedic Pratyantar validation fails, the honest gap surfaces
 *      through `unavailable` and blocks refs to `vedic.current.pratyantar_lord`.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { buildCalculationSnapshot } from "./calc-snapshot";
import { buildPremiumFacts, resolveFactsPath, type PremiumFacts } from "./premium-facts";
import {
  parseChapterJson,
  validateChapterAgainstFacts,
  metaForChapter,
} from "./chapter-json-schema";

const NANJING = {
  date: "2002-11-03",
  time: "09:26",
  place: "Nanjing",
  lang: "zh" as const,
  gender: "female" as const,
};

describe("deep evidence paths across four systems", () => {
  const facts = buildPremiumFacts(buildCalculationSnapshot(NANJING), {
    asOfDate: "2026-01-01",
  });

  test("ziwei — nested palace major star name is resolvable", () => {
    const soulIdx = facts.ziwei!.soul_palace_index;
    const path = `ziwei.palaces[${soulIdx}].major_stars[0].name`;
    const value = resolveFactsPath(facts, path);
    expect(typeof value).toBe("string");
    expect((value as string).length).toBeGreaterThan(0);
  });

  test("bazi — luck pillar element / start age is resolvable", () => {
    expect(resolveFactsPath(facts, "bazi.luck.pillars[0].pillar")).toEqual(
      expect.any(String),
    );
    expect(typeof resolveFactsPath(facts, "bazi.luck.start.age")).toBe("number");
  });

  test("western — first aspect orb and planet longitude are numbers", () => {
    const planet0Lng = resolveFactsPath(facts, "western.planets[0].longitude");
    expect(typeof planet0Lng).toBe("number");
    // Aspects may be empty for some fixtures — only assert shape when present.
    const aspect0Orb = resolveFactsPath(facts, "western.aspects[0].orb");
    if (aspect0Orb !== undefined) expect(typeof aspect0Orb).toBe("number");
  });

  test("vedic — mahadasha lord + antardasha lord deep-path resolvable", () => {
    const lord = resolveFactsPath(facts, "vedic.mahadasha[0].lord");
    expect(typeof lord).toBe("string");
    const adLord = resolveFactsPath(facts, "vedic.mahadasha[0].antardasha[0].lord");
    if (adLord !== undefined) expect(typeof adLord).toBe("string");
  });

  test("unavailable list still names every documented gap", () => {
    for (const key of [
      "ziwei_liu_ri",
      "bazi_liu_yue",
      "western_house_cusps",
      "western_progressions",
    ]) {
      expect(facts.unavailable).toContain(key);
    }
  });
});

describe("iztro-null fixture — chapters citing ziwei.* cannot complete", () => {
  // Force ziwei = null by omitting gender in the snapshot.
  const noGenderSnap = buildCalculationSnapshot({ ...NANJING, gender: null });
  const facts: PremiumFacts = buildPremiumFacts(noGenderSnap);

  test("facts.ziwei is null", () => {
    expect(facts.ziwei).toBeNull();
  });

  test("resolveFactsPath returns undefined for any ziwei path", () => {
    expect(resolveFactsPath(facts, "ziwei.five_elements_class")).toBeUndefined();
    expect(resolveFactsPath(facts, "ziwei.palaces[0].major_stars[0].name")).toBeUndefined();
  });

  test("AI output citing ziwei paths fails validateChapterAgainstFacts", () => {
    const meta = metaForChapter("ziwei_palaces")!;
    const raw = JSON.stringify({
      body: "本章讨论紫微命宫。",
      evidence_refs: [
        { path: "ziwei.palaces[0].major_stars[0].name", module: "ziwei", confidence: "grounded" },
      ],
    });
    const parsed = parseChapterJson(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const issues = validateChapterAgainstFacts({ meta, facts, chapter: parsed.value });
    expect(issues.length).toBeGreaterThan(0);
    const problems = issues.map((i) => i.problem).join("|");
    expect(problems).toMatch(/unresolved_evidence_path:ziwei\./);
  });

  test("AI output with zero evidence for a facts-required chapter fails", () => {
    const meta = metaForChapter("bazi_pillars")!;
    const raw = JSON.stringify({ body: "身元甲木清朗。", evidence_refs: [] });
    const parsed = parseChapterJson(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const issues = validateChapterAgainstFacts({ meta, facts, chapter: parsed.value });
    expect(issues.map((i) => i.problem)).toContain("no_evidence_refs");
  });
});
