// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  PREMIUM_V3_CHAPTERS,
  PREMIUM_V3_TOTAL_TARGET_CHARS_MIN,
  PREMIUM_V3_TOTAL_TARGET_CHARS_MAX,
  validateV3Content,
  type V3ReportContent,
} from "./premium-chapters-v3";

describe("premium-chapters-v3 — catalog", () => {
  it("has 24 chapters in strict index order", () => {
    expect(PREMIUM_V3_CHAPTERS).toHaveLength(24);
    PREMIUM_V3_CHAPTERS.forEach((c, i) => expect(c.index).toBe(i));
  });
  it("total zh char target lands inside 18k-25k", () => {
    expect(PREMIUM_V3_TOTAL_TARGET_CHARS_MIN).toBeGreaterThanOrEqual(15_000);
    expect(PREMIUM_V3_TOTAL_TARGET_CHARS_MAX).toBeLessThanOrEqual(25_000);
    expect(PREMIUM_V3_TOTAL_TARGET_CHARS_MAX).toBeGreaterThanOrEqual(18_000);
  });
  it("keys are unique", () => {
    const set = new Set(PREMIUM_V3_CHAPTERS.map((c) => c.key));
    expect(set.size).toBe(24);
  });
});

const baseContent = (overrides: Partial<V3ReportContent["chapters"][number]>[] = []): V3ReportContent => ({
  schema_version: "v3",
  meta: {
    prompt_version: "premium_deep_v3",
    report_version: "premium_pdf_v1",
    lang: "zh",
    generated_at: "2026-07-17T00:00:00.000Z",
    chart_name: null,
    disclaimer: "…",
  },
  cover: { title: "test", subtitle: "test" },
  chapters: PREMIUM_V3_CHAPTERS.map((c, i) => ({
    key: c.key,
    title: c.title_zh,
    body: "占位正文，内容仅供事实校验测试使用。",
    evidence_refs:
      c.allowed_facts.length === 0
        ? []
        : c.kind === "cross"
          ? [
              { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
              { path: "ziwei.palaces[0]", module: "ziwei", confidence: "grounded" },
            ]
          : c.kind === "system"
            ? [{ path: `${c.allowed_facts[0]}.something`, module: c.allowed_facts[0], confidence: "grounded" }]
            : [{ path: `${c.allowed_facts[0]}.something`, module: c.allowed_facts[0], confidence: "traditional" }],
    ...overrides[i],
  })),
  budget: { total_input_tokens: 0, total_output_tokens: 0, stopped_reason: null },
});

describe("premium-chapters-v3 — validator", () => {
  it("passes a fully-populated correct report", () => {
    expect(validateV3Content(baseContent())).toEqual([]);
  });

  it("flags empty body", () => {
    const c = baseContent();
    c.chapters[3].body = "   ";
    expect(validateV3Content(c).some((i) => i.problem === "empty_body")).toBe(true);
  });

  it("flags disallowed fact module", () => {
    const c = baseContent();
    c.chapters[3].evidence_refs = [{ path: "bazi.x", module: "bazi", confidence: "grounded" }]; // western chapter citing bazi
    expect(validateV3Content(c).some((i) => i.problem.startsWith("disallowed_fact_module"))).toBe(true);
  });

  it("flags cross-tradition chapter with <2 modules", () => {
    const c = baseContent();
    // chapter index 12 is convergence (cross)
    c.chapters[12].evidence_refs = [{ path: "bazi.x", module: "bazi", confidence: "grounded" }];
    expect(validateV3Content(c).some((i) => i.problem === "cross_chapter_needs_two_modules")).toBe(true);
  });

  it("flags system chapter without any grounded evidence", () => {
    const c = baseContent();
    c.chapters[3].evidence_refs = [{ path: "western.x", module: "western", confidence: "reflective" }];
    expect(validateV3Content(c).some((i) => i.problem === "system_chapter_needs_grounded")).toBe(true);
  });

  it("flags malformed evidence path", () => {
    const c = baseContent();
    c.chapters[3].evidence_refs = [{ path: "not a path!!", module: "western", confidence: "grounded" }];
    expect(validateV3Content(c).some((i) => i.problem.startsWith("bad_evidence_path"))).toBe(true);
  });
});
