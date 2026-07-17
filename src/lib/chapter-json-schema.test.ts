// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import {
  extractJsonObject,
  parseChapterJson,
  validateChapterAgainstFacts,
  metaForChapter,
} from "./chapter-json-schema";
import { buildPremiumFacts } from "./premium-facts";
import { buildCalculationSnapshot } from "./calc-snapshot";

const snap = buildCalculationSnapshot({
  date: "2002-11-03",
  time: "09:26",
  place: "Nanjing",
  lang: "zh",
  gender: "female",
});
const FACTS = buildPremiumFacts(snap);

describe("extractJsonObject", () => {
  test("strips ```json fences", () => {
    const raw = '```json\n{"body":"hi","evidence_refs":[]}\n```';
    expect(extractJsonObject(raw)).toBe('{"body":"hi","evidence_refs":[]}');
  });
  test("returns null when no braces present", () => {
    expect(extractJsonObject("nope")).toBeNull();
  });
  test("accepts JSON amid commentary", () => {
    const raw = 'Sure — here it is:\n{"body":"x","evidence_refs":[]}\nthanks';
    expect(extractJsonObject(raw)).toBe('{"body":"x","evidence_refs":[]}');
  });
});

describe("parseChapterJson", () => {
  test("valid object parses", () => {
    const r = parseChapterJson('{"body":"hello","evidence_refs":[]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe("hello");
  });
  test("malformed JSON → error", () => {
    const r = parseChapterJson("{not json}");
    expect(r.ok).toBe(false);
  });
  test("missing body → schema error", () => {
    const r = parseChapterJson('{"evidence_refs":[]}');
    expect(r.ok).toBe(false);
  });
  test("bad path shape → schema error", () => {
    const r = parseChapterJson(
      '{"body":"x","evidence_refs":[{"path":"not a path!!","module":"bazi","confidence":"grounded"}]}',
    );
    expect(r.ok).toBe(false);
  });
  test("unknown module → schema error", () => {
    const r = parseChapterJson(
      '{"body":"x","evidence_refs":[{"path":"bazi.pillars.day","module":"tarot","confidence":"grounded"}]}',
    );
    expect(r.ok).toBe(false);
  });
});

describe("validateChapterAgainstFacts", () => {
  test("system chapter with resolved grounded evidence passes", () => {
    const meta = metaForChapter("bazi_pillars")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
        ],
      },
    });
    expect(issues).toEqual([]);
  });
  test("cross-tradition chapter needs 2+ modules", () => {
    const meta = metaForChapter("convergence")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
        ],
      },
    });
    expect(issues.some((i) => i.problem === "cross_chapter_needs_two_modules")).toBe(true);
  });
  test("system chapter must have grounded evidence", () => {
    const meta = metaForChapter("bazi_pillars")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.day", module: "bazi", confidence: "reflective" },
        ],
      },
    });
    expect(issues.some((i) => i.problem === "system_chapter_needs_grounded")).toBe(true);
  });
  test("disallowed module rejected", () => {
    const meta = metaForChapter("western_natal")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
        ],
      },
    });
    expect(issues.some((i) => i.problem.startsWith("disallowed_fact_module"))).toBe(true);
  });
  test("unresolvable path rejected", () => {
    const meta = metaForChapter("bazi_pillars")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.nonexistent", module: "bazi", confidence: "grounded" },
        ],
      },
    });
    expect(issues.some((i) => i.problem.startsWith("unresolved_evidence_path"))).toBe(true);
  });
  test("cover chapter must NOT cite facts", () => {
    const meta = metaForChapter("cover_letter")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: {
        body: "…",
        evidence_refs: [
          { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
        ],
      },
    });
    expect(issues.some((i) => i.problem === "unexpected_evidence_refs")).toBe(true);
  });
  test("fact-allowed chapter with zero refs is rejected", () => {
    const meta = metaForChapter("bazi_pillars")!;
    const issues = validateChapterAgainstFacts({
      meta,
      facts: FACTS,
      chapter: { body: "…", evidence_refs: [] },
    });
    expect(issues.some((i) => i.problem === "no_evidence_refs")).toBe(true);
  });
});
