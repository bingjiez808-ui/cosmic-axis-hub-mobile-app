/**
 * Test / DEV-only fixture that builds a complete 24-chapter
 * PremiumContent + PremiumReportProgress payload using the CURRENT
 * PREMIUM_REPORT_REVISION and the deterministic body/refs helpers
 * shared with the server generator. No network, no DB, no AI.
 *
 * The fixture mirrors what `getPremiumReport` / `getPremiumReportProgress`
 * return for a fully-completed report, so passing it into
 * <PremiumReportReader injectedContent .../> exercises the real render
 * path — same layout, same TOC observer, same nav — without needing a
 * signed-in user or a live DB.
 */

import {
  PREMIUM_REPORT_REVISION,
  PREMIUM_REPORT_SCHEMA_V3,
  PREMIUM_V3_CHAPTERS,
  type EvidenceRef,
  type V3ChapterMeta,
} from "./premium-chapters-v3";
import type { PremiumContent } from "./premium.functions";
import type { PremiumReportProgress } from "./premium.functions";

const EVIDENCE_POOL: EvidenceRef[] = [
  { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
  { path: "bazi.pillars.year", module: "bazi", confidence: "grounded" },
  { path: "ziwei.five_elements_class", module: "ziwei", confidence: "grounded" },
  { path: "ziwei.palaces[0]", module: "ziwei", confidence: "traditional" },
  { path: "western.sun", module: "western", confidence: "grounded" },
  { path: "western.moon", module: "western", confidence: "grounded" },
  { path: "vedic.moon", module: "vedic", confidence: "grounded" },
  { path: "bazi_luck.current", module: "bazi_luck", confidence: "grounded" },
  { path: "ziwei_horoscope.year", module: "ziwei_horoscope", confidence: "grounded" },
  { path: "vedic_dasha.current", module: "vedic_dasha", confidence: "grounded" },
  { path: "western_aspects.list[0]", module: "western_aspects", confidence: "grounded" },
];

function fixtureRefs(meta: V3ChapterMeta): EvidenceRef[] {
  if (meta.allowed_facts.length === 0) return [];
  const allowed = EVIDENCE_POOL.filter((r) => meta.allowed_facts.includes(r.module));
  const minRefs = meta.min_evidence_refs ?? (meta.kind === "cross" ? 2 : 1);
  const minVar = meta.min_module_variety ?? (meta.kind === "cross" ? 2 : 0);
  const picks: EvidenceRef[] = [];
  const seenModules = new Set<string>();
  for (const r of allowed) {
    if (!seenModules.has(r.module)) {
      picks.push(r);
      seenModules.add(r.module);
    }
    if (picks.length >= Math.max(minRefs, minVar) && seenModules.size >= minVar) break;
  }
  for (const r of allowed) {
    if (picks.length >= Math.max(minRefs, minVar)) break;
    if (!picks.includes(r)) picks.push(r);
  }
  if (picks.length === 0 && allowed.length > 0) picks.push(allowed[0]);
  return picks;
}

function fixtureBody(meta: V3ChapterMeta, title: string, lang: "zh" | "en"): string {
  const isZh = lang === "zh";
  const parts: string[] = [];
  parts.push(title);
  parts.push("");
  parts.push(
    isZh
      ? `本章以确定性事实为基础展开阐释（章节 ${meta.index + 1}/24 · ${meta.key}）。文中所有结论都可以在下方证据溯源里追溯到本地排盘模块，不由 AI 自由创作。`
      : `Grounded interpretation for chapter ${meta.index + 1}/24 (${meta.key}). Every claim traces back to a local calculator module in the evidence panel below.`,
  );
  parts.push("");
  parts.push(
    isZh
      ? "为了让样式演练更接近真实报告，这里放入几段长度不同的段落，方便验证行距、断字与列表在不同视口下的呈现。"
      : "To exercise the layout, a few paragraphs of varying length live here so we can verify leading, wrapping and lists across viewports.",
  );
  if (meta.required_sections?.length) {
    for (const sec of meta.required_sections) {
      const marker = isZh ? sec.marker_zh : sec.marker_en;
      parts.push("");
      parts.push(`## ${marker}`);
      parts.push(
        isZh
          ? `围绕「${marker}」，结合本命与行运给出现实表现、条件反证与建议；置信度依据 evidence_refs 计算。`
          : `Around "${marker}", combine natal and transit facts to describe real-world signs, counter-evidence, and suggestions; confidence follows evidence_refs.`,
      );
    }
  }
  if (meta.required_tables?.length) {
    for (const tab of meta.required_tables) {
      const t = isZh ? tab.title_zh : tab.title_en;
      parts.push("");
      parts.push(`### ${t}`);
      if (isZh) {
        parts.push("| 维度 | 表现 | 条件 | 建议 |");
        parts.push("| --- | --- | --- | --- |");
        parts.push("| 主线 | 由事实推导的稳定倾向 | 需要满足的现实条件 | 立即可行的一步 |");
        parts.push("| 变量 | 受行运影响的波动区间 | 触发/减弱的条件 | 观察指标 |");
      } else {
        parts.push("| Dimension | Pattern | Condition | Suggestion |");
        parts.push("| --- | --- | --- | --- |");
        parts.push("| Main | Stable tendency from facts | Real-world precondition | Immediate step |");
        parts.push("| Variable | Range shaped by transits | Trigger / dampener | Observation metric |");
      }
    }
  }
  return parts.join("\n");
}

export function buildReaderFixture(lang: "zh" | "en" = "zh"): {
  content: PremiumContent;
  progress: PremiumReportProgress;
} {
  const generated_at = "2026-07-19T00:00:00.000Z";
  const chapters = PREMIUM_V3_CHAPTERS.map((meta) => {
    const title = lang === "zh" ? meta.title_zh : meta.title_en;
    return {
      key: meta.key,
      title,
      body: fixtureBody(meta, title, lang),
      evidence_refs: fixtureRefs(meta),
      confidence: "reflective" as const,
    };
  });

  const content: PremiumContent = {
    meta: {
      prompt_version: PREMIUM_REPORT_REVISION,
      report_version: "v3",
      report_schema_version: PREMIUM_REPORT_SCHEMA_V3,
      generated_at,
      lang,
      chart_name: lang === "zh" ? "测试命盘 · 示例" : "Test Chart · Fixture",
      disclaimer:
        lang === "zh"
          ? "本报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。"
          : "This report is for cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
    },
    cover: {
      title: lang === "zh" ? "命运图书馆 · 高级深度阅读" : "Destiny Library · Premium Deep Reading",
      subtitle:
        lang === "zh"
          ? "由本地排盘引擎生成的 24 章事实解读，用于视觉与交互回归。"
          : "Twenty-four fact-grounded chapters produced by the local engines — used for visual & interaction regression.",
    },
    chapters,
  };

  const progress: PremiumReportProgress = {
    reportStatus: "completed",
    schemaVersion: "v3",
    totalChapters: chapters.length,
    completedChapters: chapters.length,
    failedChapters: 0,
    runningChapters: 0,
    canContinue: false,
    chapters: PREMIUM_V3_CHAPTERS.map((meta) => ({
      key: meta.key,
      index: meta.index,
      title: lang === "zh" ? meta.title_zh : meta.title_en,
      status: "completed",
      attemptCount: 1,
      errorMessage: null,
    })),
  };

  return { content, progress };
}
