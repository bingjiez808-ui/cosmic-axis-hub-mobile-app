/**
 * Premium report — v3 schema: 24-chapter catalogue with structured
 * evidence references + confidence tiers.
 *
 * v3 is additive:
 *   • Old v1/v2 rows keep serving their existing content_json.
 *   • v3-tagged content_json includes `schema_version: "v3"` and a
 *     new `evidence_refs` field per chapter section.
 *   • The catalog below is the SINGLE source of truth for chapter
 *     order, titles, target word counts, and which fact modules each
 *     chapter is allowed to cite (whitelist enforced by the validator).
 */

export const PREMIUM_REPORT_SCHEMA_V3 = "v3";

/**
 * Manifest revision tag. Bumping this creates a NEW premium_pdf_reports
 * row (input_hash changes because prompt_version is part of the canonical
 * engine input). Old completed rows keep their existing content_json and
 * are never overwritten — the reader picks up the newest row per chart.
 */
export const PREMIUM_REPORT_REVISION = "premium_v3_rev_2026_07";

export type FactModule =
  | "bazi"
  | "bazi_luck"
  | "ziwei"
  | "ziwei_horoscope"
  | "western"
  | "western_aspects"
  | "vedic"
  | "vedic_dasha";

export type ConfidenceTier = "grounded" | "traditional" | "reflective";

export type V3ChapterMeta = {
  key: string;
  index: number;
  title_zh: string;
  title_en: string;
  /** Target CJK character count (used to compute wordbudget in prompt). */
  target_chars_zh: [min: number, max: number];
  /** Which fact modules this chapter may cite. Empty = no facts allowed. */
  allowed_facts: FactModule[];
  /** Whether the chapter is a "cover / methodology" scaffold or a body chapter. */
  kind: "cover" | "system" | "cross" | "life" | "timing" | "closing";
  /** Named sections whose header markers MUST appear in the chapter body. */
  required_sections?: { key: string; marker_zh: string; marker_en: string }[];
  /** Named tables (markdown pipe tables) whose title MUST appear in the body. */
  required_tables?: { key: string; title_zh: string; title_en: string }[];
  /** Minimum unique fact modules referenced. Defaults to 1 (system) / 2 (cross). */
  min_module_variety?: number;
  /** Minimum evidence_refs count. Defaults to 1 when allowed_facts is non-empty. */
  min_evidence_refs?: number;
};

const VOCATION_SECTIONS = [
  { key: "industries", marker_zh: "适合行业族群", marker_en: "Industry Fit" },
  { key: "roles", marker_zh: "岗位职能", marker_en: "Role Profile" },
  { key: "environment", marker_zh: "工作环境", marker_en: "Work Environment" },
  { key: "founding_vs_employed", marker_zh: "创业与就业条件", marker_en: "Founding vs. Employment" },
  { key: "skills", marker_zh: "关键技能", marker_en: "Key Skills" },
  { key: "avoid_patterns", marker_zh: "不适合模式", marker_en: "Patterns to Avoid" },
];
const RELATIONSHIP_SECTIONS = [
  { key: "needs", marker_zh: "关系需求", marker_en: "Relationship Needs" },
  { key: "partner_traits", marker_zh: "适合伴侣特质", marker_en: "Partner Traits" },
  { key: "conflict", marker_zh: "冲突模式", marker_en: "Conflict Patterns" },
  { key: "readiness", marker_zh: "婚恋准备", marker_en: "Readiness" },
  { key: "windows", marker_zh: "条件式时间窗口", marker_en: "Conditional Windows" },
];
const WEALTH_SECTIONS = [
  { key: "sources", marker_zh: "财富来源", marker_en: "Wealth Sources" },
  { key: "risks", marker_zh: "风险模式", marker_en: "Risk Patterns" },
  { key: "accumulation", marker_zh: "积累策略", marker_en: "Accumulation Strategy" },
];
const MISSION_SECTIONS = [
  { key: "themes", marker_zh: "核心课题", marker_en: "Core Themes" },
  { key: "triggers", marker_zh: "触发情境", marker_en: "Triggers" },
  { key: "avoid", marker_zh: "需避免的问题", marker_en: "Pitfalls to Avoid" },
  { key: "alternatives", marker_zh: "替代行动", marker_en: "Alternative Actions" },
  { key: "review", marker_zh: "复盘清单", marker_en: "Review Checklist" },
];

// 24 chapters × avg ~800 zh chars = ~19k chars, comfortably in the 18k-25k range.
export const PREMIUM_V3_CHAPTERS: V3ChapterMeta[] = [
  { key: "cover_letter", index: 0, title_zh: "写在开篇的话", title_en: "Opening Letter", target_chars_zh: [400, 700], allowed_facts: [], kind: "cover" },
  { key: "executive_summary", index: 1, title_zh: "执行摘要", title_en: "Executive Summary", target_chars_zh: [700, 1100], allowed_facts: ["bazi","ziwei","western","vedic"], kind: "cover" },
  { key: "chart_map", index: 2, title_zh: "命盘全景导览", title_en: "Chart Map", target_chars_zh: [500, 800], allowed_facts: ["bazi","ziwei","western","vedic"], kind: "cover" },

  { key: "western_natal", index: 3, title_zh: "西方本命盘", title_en: "Western Natal", target_chars_zh: [800, 1200], allowed_facts: ["western"], kind: "system" },
  {
    key: "western_aspects", index: 4, title_zh: "西方相位网", title_en: "Western Aspects",
    target_chars_zh: [900, 1200], allowed_facts: ["western","western_aspects"], kind: "system",
    required_tables: [{ key: "aspects", title_zh: "主要相位对照表", title_en: "Major Aspects Table" }],
    min_evidence_refs: 3,
  },
  { key: "vedic_natal", index: 5, title_zh: "印度本命图", title_en: "Vedic Natal", target_chars_zh: [800, 1200], allowed_facts: ["vedic"], kind: "system" },
  { key: "vedic_dasha", index: 6, title_zh: "Vimshottari 大限流曜", title_en: "Vimshottari Dasha", target_chars_zh: [800, 1100], allowed_facts: ["vedic","vedic_dasha"], kind: "system" },
  { key: "bazi_pillars", index: 7, title_zh: "八字四柱与日主", title_en: "BaZi Four Pillars", target_chars_zh: [900, 1300], allowed_facts: ["bazi"], kind: "system" },
  { key: "bazi_ten_gods", index: 8, title_zh: "八字十神与五行", title_en: "BaZi Ten Gods & Elements", target_chars_zh: [800, 1100], allowed_facts: ["bazi"], kind: "system" },
  { key: "bazi_luck", index: 9, title_zh: "八字大运与流年", title_en: "BaZi Luck Cycles", target_chars_zh: [800, 1100], allowed_facts: ["bazi","bazi_luck"], kind: "system" },
  { key: "ziwei_palaces", index: 10, title_zh: "紫微十二宫与主星", title_en: "Zi Wei Palaces & Stars", target_chars_zh: [900, 1300], allowed_facts: ["ziwei"], kind: "system" },
  { key: "ziwei_horoscope", index: 11, title_zh: "紫微大限流年流月", title_en: "Zi Wei Horoscope", target_chars_zh: [800, 1100], allowed_facts: ["ziwei","ziwei_horoscope"], kind: "system" },

  { key: "convergence", index: 12, title_zh: "跨体系共识", title_en: "Cross-Tradition Convergence", target_chars_zh: [700, 1000], allowed_facts: ["bazi","ziwei","western","vedic"], kind: "cross" },
  { key: "tensions", index: 13, title_zh: "跨体系张力与矛盾", title_en: "Cross-Tradition Tensions", target_chars_zh: [600, 900], allowed_facts: ["bazi","ziwei","western","vedic"], kind: "cross" },

  { key: "character", index: 14, title_zh: "性格底色", title_en: "Character", target_chars_zh: [700, 1000], allowed_facts: ["bazi","ziwei","western"], kind: "life" },
  {
    key: "vocation", index: 15, title_zh: "事业方向与天赋", title_en: "Vocation & Talents",
    target_chars_zh: [900, 1300], allowed_facts: ["bazi","ziwei","western","vedic"], kind: "life",
    required_sections: VOCATION_SECTIONS,
    required_tables: [{ key: "vocation_map", title_zh: "事业方向对照表", title_en: "Vocation Direction Table" }],
    min_module_variety: 2, min_evidence_refs: 3,
  },
  {
    key: "wealth", index: 16, title_zh: "财富格局", title_en: "Wealth",
    target_chars_zh: [700, 1000], allowed_facts: ["bazi","ziwei"], kind: "life",
    required_sections: WEALTH_SECTIONS,
    required_tables: [{ key: "wealth_sources", title_zh: "财富来源对照表", title_en: "Wealth Sources Table" }],
    min_module_variety: 2, min_evidence_refs: 2,
  },
  {
    key: "relationships", index: 17, title_zh: "情感与关系", title_en: "Love & Relationships",
    target_chars_zh: [900, 1200], allowed_facts: ["bazi","ziwei","western"], kind: "life",
    required_sections: RELATIONSHIP_SECTIONS,
    required_tables: [{ key: "relationship_windows", title_zh: "关系窗口对照表", title_en: "Relationship Windows Table" }],
    min_module_variety: 2, min_evidence_refs: 3,
  },
  { key: "family", index: 18, title_zh: "家庭与家园", title_en: "Family & Home", target_chars_zh: [500, 800], allowed_facts: ["bazi","ziwei"], kind: "life" },
  { key: "health", index: 19, title_zh: "健康与活力", title_en: "Health & Vitality", target_chars_zh: [500, 800], allowed_facts: ["bazi","ziwei"], kind: "life" },
  {
    key: "mission", index: 20, title_zh: "人生使命", title_en: "Life Mission",
    target_chars_zh: [700, 1000], allowed_facts: ["ziwei","vedic","western"], kind: "life",
    required_sections: MISSION_SECTIONS,
    required_tables: [{ key: "mission_checklist", title_zh: "课题清单", title_en: "Mission Checklist" }],
    min_module_variety: 2, min_evidence_refs: 3,
  },

  { key: "year_ahead", index: 21, title_zh: "未来十二个月", title_en: "Next Twelve Months", target_chars_zh: [800, 1200], allowed_facts: ["bazi_luck","ziwei_horoscope","vedic_dasha"], kind: "timing" },
  { key: "windows", index: 22, title_zh: "关键时间窗口", title_en: "Key Time Windows", target_chars_zh: [600, 900], allowed_facts: ["bazi_luck","ziwei_horoscope","vedic_dasha"], kind: "timing" },

  { key: "methodology", index: 23, title_zh: "方法论与免责声明", title_en: "Methodology & Disclaimers", target_chars_zh: [400, 700], allowed_facts: [], kind: "closing" },
];

export const PREMIUM_V3_TOTAL_TARGET_CHARS_MIN = PREMIUM_V3_CHAPTERS.reduce((a, c) => a + c.target_chars_zh[0], 0);
export const PREMIUM_V3_TOTAL_TARGET_CHARS_MAX = PREMIUM_V3_CHAPTERS.reduce((a, c) => a + c.target_chars_zh[1], 0);

/* ------------------------------------------------------------------ */
/* Evidence reference schema + validator.                              */
/* ------------------------------------------------------------------ */

/**
 * An evidence_ref points into the immutable premium_facts JSON tree
 * by path. Format: "bazi.pillars.day", "ziwei.palaces[0].main_stars".
 * The validator only checks path *shape*, not content — a missing key
 * is a runtime miss caught by the reader.
 */
export type EvidenceRef = {
  path: string;
  module: FactModule;
  confidence: ConfidenceTier;
};

export type V3ChapterContent = {
  key: string;
  title: string;
  body: string;
  evidence_refs: EvidenceRef[];
};

export type V3ReportContent = {
  schema_version: typeof PREMIUM_REPORT_SCHEMA_V3;
  meta: {
    prompt_version: string;
    report_version: string;
    lang: "zh" | "en";
    generated_at: string;
    chart_name: string | null;
    disclaimer: string;
  };
  cover: { title: string; subtitle: string };
  facts?: unknown;
  chapters: V3ChapterContent[];
  budget: {
    total_input_tokens: number;
    total_output_tokens: number;
    stopped_reason: null | "report_input_exhausted" | "report_output_exhausted";
  };
};

export type ValidationIssue = { chapter_key: string; problem: string };

const PATH_SHAPE = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*|\[\d+\])*$/i;

export function validateV3Content(content: V3ReportContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catalog = new Map(PREMIUM_V3_CHAPTERS.map((c) => [c.key, c]));

  const seen = new Set<string>();
  for (const ch of content.chapters) {
    if (seen.has(ch.key)) issues.push({ chapter_key: ch.key, problem: "duplicate_chapter" });
    seen.add(ch.key);
    const meta = catalog.get(ch.key);
    if (!meta) {
      issues.push({ chapter_key: ch.key, problem: "unknown_chapter_key" });
      continue;
    }
    if (typeof ch.body !== "string" || ch.body.trim().length === 0) {
      issues.push({ chapter_key: ch.key, problem: "empty_body" });
    }
    for (const ref of ch.evidence_refs) {
      if (!PATH_SHAPE.test(ref.path)) {
        issues.push({ chapter_key: ch.key, problem: `bad_evidence_path:${ref.path}` });
      }
      if (meta.allowed_facts.length > 0 && !meta.allowed_facts.includes(ref.module)) {
        issues.push({ chapter_key: ch.key, problem: `disallowed_fact_module:${ref.module}` });
      }
    }
    // Cross-tradition chapters must cite ≥2 modules
    if (meta.kind === "cross" && new Set(ch.evidence_refs.map((r) => r.module)).size < 2) {
      issues.push({ chapter_key: ch.key, problem: "cross_chapter_needs_two_modules" });
    }
    // System chapters must cite at least one grounded evidence (unless meta.allowed_facts is empty)
    if (meta.kind === "system" && meta.allowed_facts.length > 0) {
      const hasGrounded = ch.evidence_refs.some((r) => r.confidence === "grounded");
      if (!hasGrounded) issues.push({ chapter_key: ch.key, problem: "system_chapter_needs_grounded" });
    }
    const lang = content.meta?.lang === "en" ? "en" : "zh";
    const body = typeof ch.body === "string" ? ch.body : "";
    if (meta.required_sections?.length) {
      for (const sec of meta.required_sections) {
        const marker = lang === "en" ? sec.marker_en : sec.marker_zh;
        if (!body.includes(marker)) {
          issues.push({ chapter_key: ch.key, problem: `missing_section:${sec.key}` });
        }
      }
    }
    if (meta.required_tables?.length) {
      for (const tab of meta.required_tables) {
        const title = lang === "en" ? tab.title_en : tab.title_zh;
        if (!body.includes(title) || !body.includes("|")) {
          issues.push({ chapter_key: ch.key, problem: `missing_table:${tab.key}` });
        }
      }
    }
    const uniqueModules = new Set(ch.evidence_refs.map((r) => r.module)).size;
    const minVar = meta.min_module_variety ?? (meta.kind === "cross" ? 2 : 0);
    if (minVar > 0 && uniqueModules < minVar) {
      issues.push({ chapter_key: ch.key, problem: `insufficient_module_variety:${uniqueModules}/${minVar}` });
    }
    const minRefs = meta.min_evidence_refs ?? (meta.allowed_facts.length > 0 ? 1 : 0);
    if (minRefs > 0 && ch.evidence_refs.length < minRefs) {
      issues.push({ chapter_key: ch.key, problem: `insufficient_evidence_refs:${ch.evidence_refs.length}/${minRefs}` });
    }
  }
  return issues;
}
