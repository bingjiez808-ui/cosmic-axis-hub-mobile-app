import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";


const Input = z.object({
  name: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  place: z.string().optional(),
  lang: z.enum(["en", "zh"]).default("en"),
  quiz: z.string().optional(),
  // Structured astrology facts computed on the client so the model
  // grounds every dimension in the visitor's real chart.
  planets: z
    .array(
      z.object({
        name: z.string(),
        sign: z.string(),
        house: z.number().optional(),
      }),
    )
    .default([]),
  bazi: z.string().optional(),
  zodiac: z.string().optional(),
  lunar: z.string().optional(),
});

export type ReportDimensionAI = {
  key: string;
  headline: string;
  evidence: { tradition: string; note: string }[];
  synthesis: string;
  plain: string;
  details: { label: string; items: string[] }[];
};

export type ReportAI = {
  summary: string;
  dimensions: ReportDimensionAI[];
};

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ReportAI> => {

    const DIM_KEYS = [
      "character",
      "vocation",
      "wealth",
      "love",
      "health",
      "parents",
      "children",
      "mission",
    ] as const;
    const DIM_TITLES_EN: Record<string, string> = {
      character: "Character",
      vocation: "Vocation",
      wealth: "Wealth",
      love: "Love & Marriage",
      health: "Health & Vitality",
      parents: "Parents & Family",
      children: "Children & Legacy",
      mission: "Life Mission",
    };
    const DIM_TITLES_ZH: Record<string, string> = {
      character: "性格特质",
      vocation: "事业方向",
      wealth: "财富格局",
      love: "情感与婚姻",
      health: "健康与活力",
      parents: "父母与原生家庭",
      children: "子女与传承",
      mission: "人生使命",
    };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const isZh = data.lang === "zh";

    const planetLines = data.planets
      .map((p) => `${p.name} in ${p.sign}${p.house ? ` (house ${p.house})` : ""}`)
      .join("; ");

    const chartFacts = [
      data.name && `Name: ${data.name}`,
      data.date && `Birth date (solar): ${data.date}`,
      data.time && `Birth time: ${data.time}`,
      data.place && `Birth place: ${data.place}`,
      data.lunar && `Lunar date: ${data.lunar}`,
      data.zodiac && `Chinese zodiac: ${data.zodiac}`,
      data.bazi && `BaZi four pillars: ${data.bazi}`,
      planetLines && `Western planet placements: ${planetLines}`,
      data.quiz && `Self-report calibration answers (A/B/C/D per question): ${data.quiz}`,
    ]
      .filter(Boolean)
      .join("\n");

    const uniquenessRule = isZh
      ? "硬性规则：每个维度的 headline、synthesis、plain 都必须引用至少一项出生事实（阳历日期/时辰/农历/生肖/八字/具体行星落位）。禁止使用通用模板句；如果缺少某体系的精确数据，要基于已给事实说明为近似推断。"
      : "Hard rule: every dimension's headline, synthesis and plain-language advice must cite at least one birth fact (solar date/time, lunar date, zodiac, BaZi pillars, or a concrete planet placement). Generic template sentences are forbidden; if one tradition lacks exact data, state it as an approximation grounded in the provided facts.";

    const titles = isZh ? DIM_TITLES_ZH : DIM_TITLES_EN;
    const dimList = DIM_KEYS.map((k) => `- ${k}: ${titles[k]}`).join("\n");

    const system = isZh
      ? `你是"命运图书馆"里精通西方占星、印度占星（Jyotish）、八字与紫微斗数的老者。你只输出严格合法的 JSON —— 不能有前后缀、不能有注释、不能有 Markdown 代码块。
所有文字必须紧扣来访者的真实命盘事实（阳历/农历日期、干支、生肖、行星落位与宫位）。绝不能给出任何两个人都一样的通用文字 —— 每一段都必须至少引用一条上面列出的具体事实（例如"太阳落狮子"、"甲子日主"、"农历七月"）。
${uniquenessRule}
语气：温暖、诗意、克制，像深夜烛下低声耳语。使命放在最后并总结前七维度。`
      : `You are an elder of the Library of Destiny, fluent in Western astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. You output STRICT JSON only — no prose before/after, no comments, no Markdown fences.
Every paragraph MUST anchor in the visitor's real chart facts listed below (solar / lunar date, four-pillar stems & branches, Chinese zodiac, planet placements & houses). Never produce anything two different people would receive verbatim — reference at least one concrete fact per paragraph (e.g. "Sun in Leo", "Wood Rat day master", "seventh lunar month").
${uniquenessRule}
Tone: warm, poetic, restrained — a candle-lit whisper. Place "mission" last and let it synthesise the previous seven dimensions.`;

    const schema = isZh
      ? `{
  "summary": "一段两三句、能被单独引用的诗意概括，必须直接呼应来访者具体的日/时/干支/主要行星落位",
  "dimensions": [
    {
      "key": "character | vocation | wealth | love | health | parents | children | mission",
      "headline": "8-14 字的诗意小标题",
      "evidence": [
        {"tradition": "西方占星", "note": "一句具体落位（如：太阳落狮子第 5 宫）"},
        {"tradition": "印度占星", "note": "结合日期与行星，给出具体 Nakshatra / Bhava"},
        {"tradition": "八字",   "note": "结合干支，指出日主与十神"},
        {"tradition": "紫微",   "note": "结合出生年月，落到具体宫位与主星"}
      ],
      "synthesis": "2 句跨体系合鸣，必须点出至少一条上面列出的事实",
      "plain": "2 句「说人话」——一句处境感 + 一个可执行动作",
      "details": [
        {"label": "优势 / 通道", "items": ["点 1", "点 2"]},
        {"label": "警惕 / 功课", "items": ["点 1", "点 2"]}
      ]
    }
    // …按下方八个 key 顺序，各一个对象，共 8 个
  ]
}`
      : `{
  "summary": "2-3 sentence poetic epigraph that directly echoes the visitor's specific date/time/pillars/main placements",
  "dimensions": [
    {
      "key": "character | vocation | wealth | love | health | parents | children | mission",
      "headline": "6-12 word poetic sub-title",
      "evidence": [
        {"tradition": "Astrology", "note": "one concrete placement (e.g. Sun in Leo in 5th)"},
        {"tradition": "Jyotish",   "note": "specific Nakshatra / Bhava derived from the date + planets"},
        {"tradition": "BaZi",      "note": "based on the pillars, name the day-master & a Ten God"},
        {"tradition": "Zi Wei",    "note": "specific palace + main star for this year/month of birth"}
      ],
      "synthesis": "2 sentences of cross-tradition convergence, citing at least one concrete fact",
      "plain": "2 sentences — one line about where they stand + one concrete next move",
      "details": [
        {"label": "Strengths / channels", "items": ["point 1", "point 2"]},
        {"label": "Watch-outs / lessons", "items": ["point 1", "point 2"]}
      ]
    }
    // …one object per dim key below, in the given order — 8 total
  ]
}`;

    const prompt = `${isZh ? "来访者命盘事实" : "Visitor chart facts"}:
${chartFacts || (isZh ? "（未提供）" : "(not provided)")}

${isZh ? "需要生成的维度（严格按此顺序，8 个）" : "Required dimensions (STRICT order, 8 total)"}:
${dimList}

${isZh ? "严格按下面的 JSON schema 输出（只输出 JSON，力求简洁）" : "Output strictly matches this JSON schema (JSON only, keep it tight)"}:
${schema}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.1-flash-lite"),
      system,
      prompt,
    });


    // Robust JSON extraction — strip fences and trailing prose.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "");
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonStr =
      firstBrace >= 0 && lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned;

    let parsed: ReportAI;
    try {
      parsed = JSON.parse(jsonStr) as ReportAI;
    } catch (err) {
      throw new Error(
        `Report JSON parse failed: ${(err as Error).message}. Raw head: ${jsonStr.slice(0, 240)}`,
      );
    }

    // Basic normalisation — guarantee 8 dimensions in the expected order.
    const normaliseKey = (value: string | undefined) =>
      DIM_KEYS.find((k) => k === value || value?.toLowerCase().includes(k));
    const incoming = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
    const byKey = new Map<string, ReportDimensionAI>();
    incoming.forEach((d, index) => {
      const key = normaliseKey(d.key) ?? DIM_KEYS[index];
      if (key && !byKey.has(key)) byKey.set(key, { ...d, key });
    });
    const ordered = DIM_KEYS.map((k, index): ReportDimensionAI => {
      const found = byKey.get(k) ?? incoming[index];
      return found
        ? { ...found, key: k }
        : {
          key: k,
          headline: titles[k],
          evidence: [],
          synthesis: "",
          plain: "",
          details: [],
        };
    });

    return { summary: parsed.summary ?? "", dimensions: ordered };
  });
