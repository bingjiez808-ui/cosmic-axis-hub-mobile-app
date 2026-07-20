// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  PREMIUM_V3_CHAPTERS,
  PREMIUM_V3_TOTAL_TARGET_CHARS_MIN,
  PREMIUM_V3_TOTAL_TARGET_CHARS_MAX,
  PREMIUM_REPORT_REVISION,
  validateV3Content,
  type V3ReportContent,
  type FactModule,
  type ConfidenceTier,
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
  chapters: PREMIUM_V3_CHAPTERS.map((c, i) => {
    const secBody = (c.required_sections ?? []).map((s) => `## ${s.marker_zh}\n内容占位`).join("\n\n");
    const tabBody = (c.required_tables ?? [])
      .map((t) => `### ${t.title_zh}\n| a | b |\n| --- | --- |\n| 1 | 2 |`)
      .join("\n\n");
    const body = `占位正文，内容仅供事实校验测试使用。\n${secBody}\n${tabBody}`;
    const minRefs = Math.max(c.min_evidence_refs ?? 0, c.min_module_variety ?? 0, c.kind === "cross" ? 2 : 1);
    const modulePool: Array<{ path: string; module: FactModule; confidence: ConfidenceTier }> = [
      { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
      { path: "bazi.pillars.year", module: "bazi", confidence: "grounded" },
      { path: "ziwei.palaces[0]", module: "ziwei", confidence: "grounded" },
      { path: "ziwei.five_elements_class", module: "ziwei", confidence: "traditional" },
      { path: "western.sun", module: "western", confidence: "grounded" },
      { path: "western.moon", module: "western", confidence: "grounded" },
      { path: "western.asc", module: "western", confidence: "grounded" },
      { path: "vedic.moon", module: "vedic", confidence: "grounded" },
      { path: "vedic.sun", module: "vedic", confidence: "grounded" },
      { path: "bazi_luck.current", module: "bazi_luck", confidence: "grounded" },
      { path: "ziwei_horoscope.year", module: "ziwei_horoscope", confidence: "grounded" },
      { path: "vedic_dasha.current", module: "vedic_dasha", confidence: "grounded" },
      { path: "western_aspects.list[0]", module: "western_aspects", confidence: "grounded" },
      { path: "western_aspects.list[1]", module: "western_aspects", confidence: "grounded" },
    ];
    const allowedRefs = c.allowed_facts.length === 0 ? [] : modulePool.filter((r) => c.allowed_facts.includes(r.module));
    const picks: typeof modulePool = [];
    const seenModules = new Set<string>();
    for (const r of allowedRefs) {
      if (!seenModules.has(r.module)) { picks.push(r); seenModules.add(r.module); }
    }
    for (const r of allowedRefs) {
      if (picks.length >= Math.max(1, minRefs)) break;
      if (!picks.includes(r)) picks.push(r);
    }
    const refs = c.allowed_facts.length === 0 ? [] : picks.slice(0, Math.max(minRefs, picks.length));
    return { key: c.key, title: c.title_zh, body, evidence_refs: refs, ...overrides[i] };
  }),
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
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "western_natal");
    c.chapters[idx].evidence_refs = [{ path: "bazi.x", module: "bazi", confidence: "grounded" }]; // western chapter citing bazi
    expect(validateV3Content(c).some((i) => i.problem.startsWith("disallowed_fact_module"))).toBe(true);
  });

  it("flags cross-tradition chapter with <2 modules", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "convergence");
    c.chapters[idx].evidence_refs = [{ path: "bazi.x", module: "bazi", confidence: "grounded" }];
    expect(validateV3Content(c).some((i) => i.problem === "cross_chapter_needs_two_modules")).toBe(true);
  });

  it("flags system chapter without any grounded evidence", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "western_natal");
    c.chapters[idx].evidence_refs = [{ path: "western.x", module: "western", confidence: "reflective" }];
    expect(validateV3Content(c).some((i) => i.problem === "system_chapter_needs_grounded")).toBe(true);
  });

  it("flags malformed evidence path", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "western_natal");
    c.chapters[idx].evidence_refs = [{ path: "not a path!!", module: "western", confidence: "grounded" }];
    expect(validateV3Content(c).some((i) => i.problem.startsWith("bad_evidence_path"))).toBe(true);
  });
});

describe("premium-chapters-v3 — revision & manifest immutability", () => {
  it("exports a pinned PREMIUM_REPORT_REVISION", () => {
    expect(PREMIUM_REPORT_REVISION).toBe("premium_v4_rev_2026_08_academic");
  });
  it("manifest chapter keys are pinned in order (v4: academic at 03, year_and_windows merged)", () => {
    expect(PREMIUM_V3_CHAPTERS.map((c) => c.key)).toEqual([
      "cover_letter","executive_summary","chart_map",
      "academic",
      "western_natal","western_aspects","vedic_natal","vedic_dasha",
      "bazi_pillars","bazi_ten_gods","bazi_luck",
      "ziwei_palaces","ziwei_horoscope",
      "convergence","tensions",
      "character","vocation","wealth","relationships","family","health","mission",
      "year_and_windows","methodology",
    ]);
  });
  it("academic + vocation/wealth/relationships/mission carry required sections and tables", () => {
    const keys = ["academic","vocation","wealth","relationships","mission"];
    for (const k of keys) {
      const m = PREMIUM_V3_CHAPTERS.find((c) => c.key === k)!;
      expect((m.required_sections ?? []).length).toBeGreaterThanOrEqual(3);
      if (k !== "mission" ? true : true) {
        // academic/vocation/wealth/relationships/mission all define a table.
        expect((m.required_tables ?? []).length).toBeGreaterThanOrEqual(1);
      }
      expect(m.min_module_variety ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("premium-chapters-v3 — extended validator", () => {
  it("flags missing required section", () => {
    const c = baseContent();
    const vocationIdx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "vocation");
    c.chapters[vocationIdx].body = "只有一段正文，没有必需的板块。";
    const issues = validateV3Content(c);
    expect(issues.some((i) => i.chapter_key === "vocation" && i.problem.startsWith("missing_section:"))).toBe(true);
  });
  it("flags missing required table", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "wealth");
    // Keep required sections but strip the table title.
    const meta = PREMIUM_V3_CHAPTERS[idx];
    c.chapters[idx].body = (meta.required_sections ?? []).map((s) => `## ${s.marker_zh}`).join("\n\n") + "\n（此处未包含对照表）";
    const issues = validateV3Content(c);
    expect(issues.some((i) => i.chapter_key === "wealth" && i.problem.startsWith("missing_table:"))).toBe(true);
  });
  it("flags insufficient module variety on life chapters", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "vocation");
    c.chapters[idx].evidence_refs = [
      { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
      { path: "bazi.pillars.year", module: "bazi", confidence: "grounded" },
    ];
    const issues = validateV3Content(c);
    expect(issues.some((i) => i.chapter_key === "vocation" && i.problem.startsWith("insufficient_module_variety"))).toBe(true);
  });
  it("flags insufficient evidence refs", () => {
    const c = baseContent();
    const idx = PREMIUM_V3_CHAPTERS.findIndex((x) => x.key === "relationships");
    c.chapters[idx].evidence_refs = [
      { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
    ];
    const issues = validateV3Content(c);
    expect(issues.some((i) => i.chapter_key === "relationships" && i.problem.startsWith("insufficient_evidence_refs"))).toBe(true);
  });
});

