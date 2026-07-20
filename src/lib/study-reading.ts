/**
 * study-reading — guided-domain-reading-v1 STUDY contract.
 *
 * Shared source of truth for the "Academic & Cognition" surface across:
 *   • premium report chapter 03 (`academic` slug, revision
 *     `premium_v4_rev_2026_08_academic`) — see premium-chapters-v3.ts.
 *   • V1 综合解读 academic dimension — see report.functions.ts.
 *   • V2 panorama study domain preview — see
 *     experiences/library-v2/panorama/fixtures.ts.
 *
 * The three surfaces MUST share:
 *   - the 12-section skeleton (mirrors ACADEMIC_SECTIONS)
 *   - the SubjectClusterCandidate row schema (≥3 rows)
 *   - the banned-phrase / house-gating validator
 *   - the age-band adaptation rules
 *
 * The skill version is pinned to the premium report skill version so a
 * bump on either side propagates through content_hash / input_hash and
 * invalidates cache exactly once.
 */
import { PREMIUM_SKILL_VERSION } from "./premium-chapters-v3";

export const STUDY_READING_SKILL_ID = "guided-domain-reading-v1/study" as const;
export const STUDY_READING_SKILL_VERSION = `${PREMIUM_SKILL_VERSION}+study.1` as const;

export type StudyAgeBand = "youth" | "university" | "adult_transition";

export type SubjectClusterCandidate = {
  /** Human-readable cluster label, e.g. "语言与人文表达". */
  cluster: string;
  /** high | medium | exploratory — never "guaranteed" / "recommended for admission". */
  suitability: "high" | "medium" | "exploratory";
  /** Prose reason grounded in the chart facts (must reference ≥1 evidence_ref). */
  why: string;
  /**
   * evidence_refs point into premium_facts; MUST all resolve against
   * `academic.allowed_facts` in premium-chapters-v3. Each ref carries a
   * confidence tier so downstream UI can dim reflective claims.
   */
  evidence_refs: Array<{ path: string; module: string; confidence: "grounded" | "traditional" | "reflective" }>;
  /**
   * conditions under which the cluster is genuinely a fit — the "yes if..."
   * clause. Encoded so tests can guard against unconditional destiny claims.
   */
  conditions: string[];
  /** Actionable one-sentence real-life validation step. Required. */
  how_to_validate: string;
};

export type StudyReadingContent = {
  skill_id: typeof STUDY_READING_SKILL_ID;
  skill_version: typeof STUDY_READING_SKILL_VERSION;
  age_band: StudyAgeBand;
  cognition_keywords: string[]; // rendered as chips on the reader first screen
  clusters: SubjectClusterCandidate[]; // ≥3 required
  /** 12-section prose keyed by ACADEMIC_SECTIONS key. */
  sections: Record<string, string>;
  /** disclaimer / methodology fingerprint shown at the end. */
  method_note: string;
};

export type StudyValidationIssue = { field: string; problem: string };

// -----------------------------------------------------------------------
// Banned / conditional patterns.
// -----------------------------------------------------------------------

/** Absolute admission / IQ / exam guarantees — never allowed. */
const BANNED_PATTERNS: Array<{ re: RegExp; code: string }> = [
  { re: /(?:iq|智商)\s*(?:[:：]?\s*)?\d/i, code: "iq_score_claim" },
  { re: /智商\s*(?:高|超|很)/,             code: "iq_ranking_claim" },
  { re: /保证[你您]?(?:考上|录取|考进|上岸)/, code: "admission_guarantee" },
  { re: /guaranteed?\s+(?:admission|to\s+get\s+in|acceptance)/i, code: "admission_guarantee" },
  { re: /一定能?(?:考上|考取|录取)/,       code: "admission_guarantee" },
  { re: /(?:必\s*(?:考|上|进))/,           code: "admission_guarantee" },
];

/**
 * House / MC facts require Western allowed_facts AND an explicit path prefix.
 * If academic prose mentions a house/MC without a matching evidence_ref the
 * validator flags `unsupported_house_or_mc`.
 */
const HOUSE_MC_PROSE_RE = /(?:第\s*[一二三四五六七八九十]\s*宫|3rd\s+house|9th\s+house|midheaven|\bMC\b|天顶)/i;

/**
 * A claim is "cross-system consensus" only when at least two DISTINCT
 * modules back it. If the prose says "四体系一致" / "cross-system
 * consensus" but evidence_refs come from a single module, that's a fake
 * consensus — flag it.
 */
const CONSENSUS_PROSE_RE = /(?:四体系一致|跨体系共识|cross[- ]system\s+consensus|四大体系(?:一致|都))/i;

// -----------------------------------------------------------------------
// Validator.
// -----------------------------------------------------------------------

export function validateStudyReading(content: StudyReadingContent, opts?: {
  /** allow-list of evidence path prefixes for the current chart. Empty = no filter. */
  available_paths?: string[];
  /** which fact modules exist in FACTS. */
  available_modules?: string[];
}): StudyValidationIssue[] {
  const issues: StudyValidationIssue[] = [];
  const availPaths = opts?.available_paths ?? [];
  const availModules = new Set(opts?.available_modules ?? []);

  if (content.skill_id !== STUDY_READING_SKILL_ID) issues.push({ field: "skill_id", problem: "wrong_skill_id" });
  if (content.skill_version !== STUDY_READING_SKILL_VERSION) issues.push({ field: "skill_version", problem: "wrong_skill_version" });

  // ≥3 clusters, each fully populated.
  if (!Array.isArray(content.clusters) || content.clusters.length < 3) {
    issues.push({ field: "clusters", problem: "fewer_than_three_candidates" });
  }
  (content.clusters || []).forEach((c, i) => {
    if (!c.cluster) issues.push({ field: `clusters[${i}].cluster`, problem: "empty" });
    if (!["high", "medium", "exploratory"].includes(c.suitability)) issues.push({ field: `clusters[${i}].suitability`, problem: "invalid" });
    if (!c.why || c.why.trim().length < 8) issues.push({ field: `clusters[${i}].why`, problem: "too_short" });
    if (!Array.isArray(c.evidence_refs) || c.evidence_refs.length < 1) issues.push({ field: `clusters[${i}].evidence_refs`, problem: "missing" });
    if (!Array.isArray(c.conditions) || c.conditions.length < 1) issues.push({ field: `clusters[${i}].conditions`, problem: "unconditional_claim" });
    if (!c.how_to_validate || c.how_to_validate.trim().length < 4) issues.push({ field: `clusters[${i}].how_to_validate`, problem: "missing" });
    // Every evidence_ref must resolve against available_modules & (if provided) available_paths.
    for (const ref of c.evidence_refs || []) {
      if (availModules.size > 0 && !availModules.has(ref.module)) {
        issues.push({ field: `clusters[${i}].evidence_refs`, problem: `unavailable_module:${ref.module}` });
      }
      if (availPaths.length > 0 && !availPaths.some((p) => ref.path === p || ref.path.startsWith(p + ".") || ref.path.startsWith(p + "["))) {
        issues.push({ field: `clusters[${i}].evidence_refs`, problem: `unresolved_path:${ref.path}` });
      }
    }
  });

  // Prose scans.
  const prose = [
    ...Object.values(content.sections || {}),
    ...(content.clusters || []).flatMap((c) => [c.why, ...(c.conditions || []), c.how_to_validate]),
  ].join("\n");

  for (const pat of BANNED_PATTERNS) {
    if (pat.re.test(prose)) issues.push({ field: "prose", problem: `banned:${pat.code}` });
  }

  // House / MC gating: if prose mentions a house/MC, at least one evidence_ref
  // must live under western / western_aspects with a `.house` or `.mc` fragment.
  if (HOUSE_MC_PROSE_RE.test(prose)) {
    const allRefs = (content.clusters || []).flatMap((c) => c.evidence_refs || []);
    const hasHouseRef = allRefs.some((r) => (r.module === "western" || r.module === "western_aspects")
      && /(house|mc\b|midheaven)/i.test(r.path));
    if (!hasHouseRef) issues.push({ field: "prose", problem: "unsupported_house_or_mc" });
  }

  // Fake cross-system consensus: prose asserts consensus but refs come from ≤1 module.
  if (CONSENSUS_PROSE_RE.test(prose)) {
    const modules = new Set((content.clusters || []).flatMap((c) => (c.evidence_refs || []).map((r) => r.module)));
    if (modules.size < 2) issues.push({ field: "prose", problem: "fake_cross_system_consensus" });
  }

  // Section skeleton: expect all 12 keys present.
  const required = [
    "why_now","learning_style","subject_clusters","four_systems","consensus","real_life",
    "strengths","obstacles","windows","actions","questions","method_limits",
  ];
  for (const key of required) {
    if (!content.sections || !content.sections[key] || content.sections[key].trim().length < 4) {
      issues.push({ field: `sections.${key}`, problem: "missing" });
    }
  }

  // cognition_keywords: 3–8 short chips.
  if (!Array.isArray(content.cognition_keywords) || content.cognition_keywords.length < 3 || content.cognition_keywords.length > 8) {
    issues.push({ field: "cognition_keywords", problem: "expected_3_to_8" });
  }

  // Age-band voice: youth prose must not use midlife/re-skilling markers, and
  // adult_transition must not address the reader as a school student.
  if (content.age_band === "adult_transition" && /(?:高考|中考|参加考研|校园生活)/.test(prose)) {
    issues.push({ field: "prose", problem: "school_voice_in_adult_transition" });
  }
  if (content.age_band === "youth" && /(?:退休|再就业|中年转型)/.test(prose)) {
    issues.push({ field: "prose", problem: "midlife_voice_in_youth" });
  }

  return issues;
}

// -----------------------------------------------------------------------
// Deterministic fixtures — three age bands.
//
// These are used in tests + as demo content in the reader when running
// against the deterministic provider. NEVER inserted into the DB.
// -----------------------------------------------------------------------

const REF_BAZI_DAY = { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" } as const;
const REF_ZIWEI_MAIN = { path: "ziwei.palaces[0].main_stars", module: "ziwei", confidence: "grounded" } as const;
const REF_WESTERN_MERC = { path: "western.mercury", module: "western", confidence: "grounded" } as const;
const REF_VEDIC_MOON = { path: "vedic.moon", module: "vedic", confidence: "grounded" } as const;

function base12(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    why_now: "为什么此刻先读学业与认知：四体系在你的学习通道上留下的印记都比较集中，是这张盘上信号最清晰的板块之一。",
    learning_style: "学习与认知方式：你偏向以输出反哺输入 —— 讲述、写作、动手复现会让知识真正落地。",
    subject_clusters: "学科族群候选：见下方族群对照表。每一族群都是一个方向，不是结论。",
    four_systems: "四体系独立观察：西方水星 / 印度月宿 / 八字印星 / 紫微文昌 各自给出一致的『结构 + 表达』底色。",
    consensus: "跨体系共识与分歧：四体系一致指向结构性学习偏好；分歧集中在动力来源（灵感 vs 理性）。",
    real_life: "现实中的可能表现：系统课本吸收快；纯记忆题容易疲劳；有导师时进步跳跃。",
    strengths: "优势与可利用资源：结构感 · 语言组织 · 长期专注；书籍 · 导师 · 跨学科同伴都是你可以主动动用的资源。",
    obstacles: "常见阻力与反例条件：容易『先系统学，中途换方向』；反例条件是给自己两个可交付节点。",
    windows: "当前周期与学习窗口：结合已有的大运 / Dasha / 大限，当前是一个信号偏活跃的周期，仅供观察不作保证。",
    actions: "保留 停止 开始：保留每周固定阅读节奏 / 停止同时开三门新课 / 开始为每门课设一个『我完成了』证据。",
    questions: "三个自我探索问题：什么样的知识我讲得出？我在什么环境学得最快？我愿意为哪一族群试三个月？",
    method_limits: "方法与限制：所有结论都基于本地确定性排盘和公开传统 —— 不预测录取，不评估智商，不承诺考试结果。",
    ...overrides,
  };
}

const DEFAULT_CLUSTERS: SubjectClusterCandidate[] = [
  {
    cluster: "语言与人文表达",
    suitability: "high",
    why: "水星在双子座 + 八字食伤透干 + 紫微文昌照命，共同指向语言 / 写作 / 教学通道。",
    evidence_refs: [REF_WESTERN_MERC, { path: "bazi.ten_gods.output", module: "bazi", confidence: "grounded" }, REF_ZIWEI_MAIN],
    conditions: ["有稳定的写作或讲述输出节奏", "身边至少一个能反馈内容的读者 / 听众"],
    how_to_validate: "连续 8 周每周完成一篇 800 字的输出并请一位读者反馈是否读得下去。",
  },
  {
    cluster: "社会观察与研究",
    suitability: "medium",
    why: "月宿指向知识型 Nakshatra + 八字印星旺，喜欢结构化解释现象。",
    evidence_refs: [REF_VEDIC_MOON, { path: "bazi.ten_gods.resource", module: "bazi", confidence: "grounded" }],
    conditions: ["能忍受长期数据收集", "对『解释为什么』比『解决怎么办』更有耐心"],
    how_to_validate: "选一个日常现象连续记录 30 天并写出一份两千字观察笔记。",
  },
  {
    cluster: "跨学科整合（人文 × 数据 / 设计 × 技术）",
    suitability: "exploratory",
    why: "四柱食伤 + 紫微命宫多星并见 + 水星强度中等偏上：整合能力优于单点深入。",
    evidence_refs: [REF_BAZI_DAY, REF_ZIWEI_MAIN, REF_WESTERN_MERC],
    conditions: ["有一个具体主题作锚点", "允许自己半年内不给结论"],
    how_to_validate: "挑一个具体课题，用两种不同学科视角各写一段 500 字的分析。",
  },
];

export const STUDY_FIXTURES: Record<StudyAgeBand, StudyReadingContent> = {
  youth: {
    skill_id: STUDY_READING_SKILL_ID,
    skill_version: STUDY_READING_SKILL_VERSION,
    age_band: "youth",
    cognition_keywords: ["以输出巩固", "结构+表达", "导师放大器", "跨学科整合"],
    clusters: DEFAULT_CLUSTERS,
    sections: base12({
      why_now: "为什么此刻先读学业与认知：你正处在选文理 / 选专业 / 选社团这些关键分岔口，先看清自己的学习形状可以避免大量试错。",
      real_life: "现实中的可能表现：老师讲课时你抓大纲比抓细节快；一遇到只需背诵的科目就打不起精神。",
    }),
    method_note: "本报告不预测录取结果，不评估智商，不代替真实成绩判断。",
  },
  university: {
    skill_id: STUDY_READING_SKILL_ID,
    skill_version: STUDY_READING_SKILL_VERSION,
    age_band: "university",
    cognition_keywords: ["方向筛选", "以项目学习", "导师网络", "长期专注"],
    clusters: DEFAULT_CLUSTERS,
    sections: base12({
      why_now: "为什么此刻先读学业与认知：你已经进入需要主动搭建方向的阶段 —— 选研究方向、找导师、决定是否读研，这一章是一个盘点。",
      real_life: "现实中的可能表现：喜欢通过做项目 / 写论文来吃透一门课；对纯理论课程容易掉线。",
    }),
    method_note: "本报告不预测保研 / 考研 / 就业结果；不评估智商；作为反思材料使用。",
  },
  adult_transition: {
    skill_id: STUDY_READING_SKILL_ID,
    skill_version: STUDY_READING_SKILL_VERSION,
    age_band: "adult_transition",
    cognition_keywords: ["再造知识资本", "结构 + 表达", "知识传递", "跨界迁移"],
    clusters: DEFAULT_CLUSTERS,
    sections: base12({
      why_now: "为什么此刻先读学业与认知：处在职业中段的再学习 / 再造 / 转型阶段，认知偏好比选专业更值得先看清。",
      real_life: "现实中的可能表现：你更适合以『讲一次课 / 带一名学生 / 写一份系统笔记』的方式重新学习一个领域。",
      actions: "保留 停止 开始：保留每周结构化学习一小时 / 停止无目的的碎片订阅 / 开始把你已经会的东西教给一个人。",
    }),
    method_note: "本报告面向已经离开传统校园的读者；不预测再就业结果；不评估智商。",
  },
};
