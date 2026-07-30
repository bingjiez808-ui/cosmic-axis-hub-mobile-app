import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import { isEmailVerified, assertEmailVerifiedOrAdmin } from "./reports-store.functions";
import {
  concernFocusDirective,
  coverageDirective,
  crossSystemDirective,
  systemCoverageFromFacts,
} from "./four-system-brief";





const BaseInput = z.object({
  name: z.string().max(120).optional(),
  date: z.string().max(40).optional(),
  time: z.string().max(20).optional(),
  place: z.string().max(160).optional(),
  lang: z.enum(["en", "zh"]).default("en"),
  quiz: z.string().max(400).optional(),
  // Structured astrology facts computed on the client so the model
  // grounds every dimension in the visitor's real chart.
  planets: z
    .array(
      z.object({
        name: z.string().max(40),
        sign: z.string().max(40),
        house: z.number().int().min(1).max(12).optional(),
      }),
    )
    .max(30)
    .default([]),
  bazi: z.string().max(120).optional(),
  zodiac: z.string().max(40).optional(),
  lunar: z.string().max(80).optional(),
  // Real Jyotish / Zi Wei placements computed from the birth snapshot.
  // Without these the model correctly reports "insufficient data" for
  // those two traditions, so they must always be sent when available.
  vedic: z.string().max(400).optional(),
  ziwei: z.string().max(400).optional(),
  gender: z.enum(["male", "female"]).optional(),
  /** Homepage concern selection — drives the "这次阅读会帮你分清" contract. */
  concern: z.string().max(40).optional(),
});

export const DIM_KEYS = [
  "character",
  "academic",
  "vocation",
  "wealth",
  "love",
  "health",
  "parents",
  "children",
  "mission",
] as const;
export type DimensionKey = (typeof DIM_KEYS)[number];

const DIM_TITLES_EN: Record<DimensionKey, string> = {
  character: "Character",
  academic: "Academic & Cognition",
  vocation: "Vocation",
  wealth: "Wealth",
  love: "Love & Marriage",
  health: "Health & Vitality",
  parents: "Parents & Family",
  children: "Children & Legacy",
  mission: "Life Mission",
};
const DIM_TITLES_ZH: Record<DimensionKey, string> = {
  character: "性格特质",
  academic: "学业与认知",
  vocation: "事业方向",
  wealth: "财富格局",
  love: "情感与婚姻",
  health: "健康与活力",
  parents: "父母与原生家庭",
  children: "子女与传承",
  mission: "人生使命",
};

export type ReportDimensionAI = {
  key: string;
  headline: string;
  evidence: { tradition: string; note: string }[];
  synthesis: string;
  plain: string;
  details: { label: string; items: string[] }[];
  /** Concrete, practical pointers for this dimension (label -> short answer). */
  specifics: { label: string; value: string }[];
};

export type ReportAI = {
  summary: string;
  dimensions: ReportDimensionAI[];
};


/** What the "specifics" block must answer, per dimension. Kept deliberately
   short — the exhaustive treatment belongs to the paid综合报告. */
const SPECIFIC_TOPICS_ZH: Record<string, string> = {
  character: "关键词性格标签；最舒服的相处方式；最容易被误解的一点",
  academic: "最适合的学科族群；最佳学习方式；需要补的短板",
  vocation: "适合的职业/行业（举 2-3 个具体方向）；适合的组织形态（大机构/小团队/自由职业）；不适合的工作环境",
  wealth: "主要财富来源（主业为主还是副业为主）；适合的副业方向；其他可能的进财方式（投资/版税/家族/贵人）；最需要避开的破财方式",
  love: "正缘类型（性格与相处气质，不写具体身份）；桃花较旺的时间段（年龄段或流年方向）；容易反复的关系模式；最有效的相处建议",
  health: "尤其需要注意的身体系统/部位；最容易失衡的季节或作息；一条最见效的日常调理",
  parents: "与父母的相处基调；最容易起摩擦的议题；可修复的一个具体动作",
  children: "与子女/后辈的缘分基调；教育方式建议；需要留心的一个阶段",
  mission: "此生最核心的课题一句话；最能发挥的场域；最需要放下的执念",
};
const SPECIFIC_TOPICS_EN: Record<string, string> = {
  character: "signature trait; how you are easiest to be with; what people most often misread",
  academic: "best subject clusters; best learning mode; the gap to close",
  vocation: "suitable roles/industries (2-3 concrete directions); best organisation type (large org / small team / freelance); environments to avoid",
  wealth: "primary income source (main job vs side work); a fitting side-income direction; other possible inflows (investment, royalties, family, patrons); the leak to avoid",
  love: "type of the destined partner (temperament, never a specific identity); periods when romance runs strong; the pattern that tends to repeat; the most useful relating advice",
  health: "body systems to watch most; the season or routine that destabilises you; one daily practice that works",
  parents: "the baseline tone with your parents; the topic that sparks friction; one concrete repair move",
  children: "the bond with children/juniors; a fitting way to guide them; a stage to watch",
  mission: "the core lesson of this life in one line; the field where you shine; the attachment to release",
};


/** Collapse repeated labels (the model sometimes emits one entry per system
 *  for the same question) and cap the block at 4 pointers. */
function dedupeSpecifics(list: { label: string; value: string }[]) {
  const out: { label: string; value: string }[] = [];
  for (const item of list) {
    const key = item.label.replace(/[\s·、,，]/g, "");
    const hit = out.find((o) => o.label.replace(/[\s·、,，]/g, "") === key && key !== "");
    if (hit) {
      if (!hit.value.includes(item.value)) hit.value = `${hit.value} ${item.value}`;
      continue;
    }
    out.push({ ...item });
  }
  return out.slice(0, 4);
}

function buildChartFacts(data: z.infer<typeof BaseInput>) {
  const planetLines = data.planets
    .map((p) => `${p.name} in ${p.sign}${p.house ? ` (house ${p.house})` : ""}`)
    .join("; ");
  return [
    data.name && `Name: ${data.name}`,
    data.date && `Birth date (solar): ${data.date}`,
    data.time && `Birth time: ${data.time}`,
    data.place && `Birth place: ${data.place}`,
    data.lunar && `Lunar date: ${data.lunar}`,
    data.zodiac && `Chinese zodiac: ${data.zodiac}`,
    data.bazi && `BaZi four pillars: ${data.bazi}`,
    data.vedic && `Vedic (sidereal) chart: ${data.vedic}`,
    data.ziwei && `Zi Wei Dou Shu chart: ${data.ziwei}`,
    data.gender && `Gender: ${data.gender}`,
    planetLines && `Western planet placements: ${planetLines}`,
    data.quiz && `Self-report calibration answers (A/B/C/D per question): ${data.quiz}`,
    coverageDirective(
      systemCoverageFromFacts({
        planets: data.planets,
        bazi: data.bazi,
        vedic: data.vedic,
        ziwei: data.ziwei,
      }).missing,
      data.lang,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSystem(isZh: boolean) {
  const uniquenessRule = isZh
    ? "硬性规则：每一段（headline、synthesis、plain）都必须引用至少一项出生事实（阳历日期/时辰/农历/生肖/八字/具体行星落位）。禁止使用通用模板句；缺失体系数据要说明为近似推断。"
    : "Hard rule: every paragraph (headline, synthesis, plain) must cite at least one birth fact (solar date/time, lunar date, zodiac, BaZi pillars, or a concrete planet placement). Generic template sentences are forbidden; if a tradition lacks exact data, state it as an approximation.";
  const base = isZh
    ? `你是"命运图书馆"里精通西方占星、印度占星（Jyotish）、八字与紫微斗数的老者。只输出严格合法的 JSON —— 不能有前后缀、注释或 Markdown 代码块。
所有文字必须紧扣来访者的真实命盘事实。绝不能给出任何两个人都一样的通用文字 —— 每一段都要至少引用一条上面列出的具体事实。
${uniquenessRule}
语气：温暖、诗意、克制，像深夜烛下低声耳语。`
    : `You are an elder of the Library of Destiny, fluent in Western astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. Output STRICT JSON only — no prose, comments or code fences.
Every paragraph must anchor in the visitor's real chart facts listed below — never produce text two people would receive verbatim.
${uniquenessRule}
Tone: warm, poetic, restrained — a candle-lit whisper.`;
  return `${base}\n\n${crossSystemDirective(isZh ? "zh" : "en")}\n\n${guardrailsFor(isZh ? "zh" : "en")}`;
}

/* ═══════════════════════════════════════════
   Summary — a short poetic epigraph, generated on its own
   so the client can render it as soon as it arrives.
═══════════════════════════════════════════ */
export const generateReportSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BaseInput.parse(data))
  .handler(async ({ data, context }): Promise<{ summary: string }> => {
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`report-summary:${context.userId}`, 20, 60_000, "report generations");
    try {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Report service is not configured");
      const gateway = createLovableAiGatewayProvider(key);
      const isZh = data.lang === "zh";
      const chartFacts = buildChartFacts(data);

      // One slot per topic, with the label fixed in advance. Previously the
      // template always asked for 4 free-form labels while some dimensions
      // (e.g. academic) only define 3 topics, so the model padded the extra
      // slot by repeating a label such as "适合学科族群" with a second
      // system's evidence. Fixed labels + dedupe make that impossible.
      const topicsZh = (SPECIFIC_TOPICS_ZH[dimKey] ?? "").split("；").map((t) => t.trim()).filter(Boolean);
      const topicsEn = (SPECIFIC_TOPICS_EN[dimKey] ?? "").split(";").map((t) => t.trim()).filter(Boolean);
      const specificSlotsZh = topicsZh
        .map((t, i) => `    {"label": "${t.replace(/["\\]/g, "").slice(0, 6)}", "value": "一句具体回答，25-45 字，必须引用一条命盘依据${i === 0 ? "" : ""}"}`)
        .join(",\n");
      const specificSlotsEn = topicsEn
        .map((t) => `    {"label": "${t.replace(/["\\]/g, "").split(" ").slice(0, 3).join(" ")}", "value": "one concrete sentence, 15-30 words, citing one chart fact"}`)
        .join(",\n");

      const schema = isZh
        ? `{ "summary": "两三句诗意概括，必须直接呼应来访者具体的日/时/干支/主要行星落位，并至少点名两套体系（西方 / 印度 / 八字 / 紫微）在此处的共振" }`
        : `{ "summary": "2-3 sentence poetic epigraph echoing the visitor's specific date/time/pillars/placements, naming at least two of the four systems that converge here" }`;

      const prompt = `${isZh ? "来访者命盘事实" : "Visitor chart facts"}:
${chartFacts || (isZh ? "（未提供）" : "(not provided)")}
${concernFocusDirective(data.concern, isZh ? "zh" : "en")}

${isZh ? "严格输出 JSON（只输出 JSON）" : "Output STRICT JSON only"}:
${schema}`;

      const { text } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: buildSystem(isZh),
        prompt,
      });

      const parsed = extractJson<{ summary?: string }>(text);
      return { summary: parsed.summary ?? "" };
    } catch (err) {
      throw new Error(safeMessage(err, "Report summary failed"));
    }
  });

/* ═══════════════════════════════════════════
   Per-dimension generation — one AI call per dimension.
   Client fires all 8 in parallel and renders each as it lands.
═══════════════════════════════════════════ */
const DimensionInput = BaseInput.extend({
  key: z.enum(DIM_KEYS),
});

export const generateReportDimension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DimensionInput.parse(data))
  .handler(async ({ data, context }): Promise<ReportDimensionAI> => {
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`report-dim:${context.userId}`, 40, 60_000, "dimension generations");
    try {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Report service is not configured");
      const gateway = createLovableAiGatewayProvider(key);
      const isZh = data.lang === "zh";
      const chartFacts = buildChartFacts(data);
      const titles = isZh ? DIM_TITLES_ZH : DIM_TITLES_EN;
      const dimKey = data.key;
      const dimTitle = titles[dimKey];

      const missionNote = dimKey === "mission"
        ? isZh
          ? "这是最后一个维度：合鸣并升华前八维（性格/学业/事业/财富/情感/健康/父母/子女）。"
          : "This is the final dimension: synthesise and elevate the previous eight dimensions (character / academic / vocation / wealth / love / health / parents / children)."
        : "";

      const academicNote = dimKey === "academic"
        ? isZh
          ? "学业与认知维度专注于学习方式、可能形成优势的学科族群、以及当前的学习/认知周期。硬性规则：不得断言智商、考试分数或某个专业保证成功；至少给出 3 个「学科族群候选」，每项都需要引用具体命盘事实并给出「如何在现实中验证」的一句话；若来访者年龄已超过传统求学阶段，语气自动适配为「继续教育 / 职业学习 / 知识迁移与经验传承」，不要把他写成学生。"
          : "The academic dimension is about learning style, subject clusters that may become strengths, and the current cognition/study window. Hard rules: never claim IQ, exam scores, or guaranteed success in a major; give at least 3 subject-cluster candidates, each anchored in a concrete chart fact and paired with a one-sentence 'how to validate in real life'; if the visitor is past traditional schooling age, shift the voice to continuing education, re-skilling, knowledge transfer and mentorship — do not write them as a student."
        : "";

      const schema = isZh
        ? `{
  "key": "${dimKey}",
  "headline": "8-18 字的诗意小标题",
  "evidence": [
    {"tradition": "西方占星", "note": "一句具体落位，例如：太阳落狮子第 5 宫 · 月亮合金星"},
    {"tradition": "印度占星", "note": "结合上面日期与行星，给出具体 Nakshatra / Bhava 表述"},
    {"tradition": "八字",   "note": "结合上面干支，指出日主与十神"},
    {"tradition": "紫微",   "note": "结合出生年月，落到具体宫位与主星"}
  ],
  "synthesis": "3-4 句跨体系综合：先点名哪两三套体系在此共振（并各引一条真实落位），再点名哪套体系给出不同侧写，最后一句合读结论",
  "plain": "3-4 句「说人话」——直接给来访者的行动建议，带一句他此刻的处境感",
  "details": [
    {"label": "优势 / 通道 / 缘份形状 等", "items": ["点 1", "点 2", "点 3", "点 4"]},
    {"label": "警惕 / 窗口 / 需修的功课 等", "items": ["点 1", "点 2", "点 3", "点 4"]}
  ],
  "specifics": [
${specificSlotsZh}
  ]
}`
        : `{
  "key": "${dimKey}",
  "headline": "6-14 word poetic sub-title",
  "evidence": [
    {"tradition": "Astrology", "note": "one concrete placement, e.g. Sun in Leo in 5th · Moon conjunct Venus"},
    {"tradition": "Jyotish",   "note": "specific Nakshatra / Bhava derived from the date + planets above"},
    {"tradition": "BaZi",      "note": "based on the pillars above, name the day-master & a Ten God"},
    {"tradition": "Zi Wei",    "note": "specific palace + main star for this year/month of birth"}
  ],
  "synthesis": "3-4 sentences of real cross-system synthesis: name the 2-3 systems that converge here (each with one real placement), name the system that reads it differently, then one combined conclusion",
  "plain": "3-4 sentences in everyday words — a concrete next move plus one line about where they stand right now",
  "details": [
    {"label": "Strengths / channels / shape of the bond etc.", "items": ["point 1", "point 2", "point 3", "point 4"]},
    {"label": "Watch-outs / windows / lessons etc.", "items": ["point 1", "point 2", "point 3", "point 4"]}
  ],
  "specifics": [
${specificSlotsEn}
  ]
}`;

      const prompt = `${isZh ? "来访者命盘事实" : "Visitor chart facts"}:
${chartFacts || (isZh ? "（未提供）" : "(not provided)")}

${concernFocusDirective(data.concern, isZh ? "zh" : "en")}
${isZh ? "需要生成的维度" : "Dimension to generate"}: ${dimKey} · ${dimTitle}
${
  isZh
    ? `"specifics" 必须逐条覆盖这些问题（每条一句话，点到为止，不展开长篇；越具体越好，但不得给出医疗/法律/投资承诺）：${SPECIFIC_TOPICS_ZH[dimKey] ?? ""}。每个问题只输出一条，label 必须互不重复（不要把同一个 label 拆成多条来分别引用不同体系；跨体系证据请合并进同一条 value）。最后不要在 specifics 里写任何推销文字。`
    : `"specifics" must cover each of these questions (one short sentence each — pointed, not exhaustive; concrete but never a medical/legal/financial promise): ${SPECIFIC_TOPICS_EN[dimKey] ?? ""}. Emit exactly one entry per question and never repeat a label (do not split one label into several entries to cite different systems — merge cross-system evidence into the same value). Do not put any sales copy inside specifics.`
}
${missionNote}${academicNote}

${isZh ? "严格输出 JSON（只输出 JSON）" : "Output STRICT JSON only"}:
${schema}`;

      const { text } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: buildSystem(isZh),
        prompt,
      });

      const parsed = extractJson<Partial<ReportDimensionAI>>(text);
      return {
        key: dimKey,
        headline: parsed.headline ?? dimTitle,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 4) : [],
        synthesis: parsed.synthesis ?? "",
        plain: parsed.plain ?? "",
        details: Array.isArray(parsed.details) ? parsed.details.slice(0, 2) : [],
        specifics: Array.isArray(parsed.specifics)
          ? dedupeSpecifics(
              parsed.specifics
                .filter((x) => x && typeof x === "object")
                .map((x) => ({ label: String(x.label ?? ""), value: String(x.value ?? "") }))
                .filter((x) => x.value),
            )
          : [],
      };
    } catch (err) {
      throw new Error(safeMessage(err, "Dimension generation failed"));
    }
  });

/* ═══════════════════════════════════════════
   Legacy one-shot generator — kept for callers (edge tools, MCP)
   that still want a single response. Internally now composes the
   streaming pieces so behaviour stays consistent.
═══════════════════════════════════════════ */
export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BaseInput.parse(data))
  .handler(async ({ data, context }): Promise<ReportAI> => {
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`report-full:${context.userId}`, 5, 60_000, "full report generations");
    // Sub-calls run their own auth + rate checks via the exported fns.
    const [{ summary }, ...dims] = await Promise.all([
      generateReportSummary({ data }),
      ...DIM_KEYS.map((k) => generateReportDimension({ data: { ...data, key: k } })),
    ]);
    return { summary, dimensions: dims };
  });

/* ═══════════════════════════════════════════
   Shared JSON extraction helper.
═══════════════════════════════════════════ */
function extractJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  const jsonStr = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    throw new Error(
      `JSON parse failed: ${(err as Error).message}. Head: ${jsonStr.slice(0, 240)}`,
    );
  }
}
