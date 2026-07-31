/**
 * daily-reading-v1 — AI explanation layer for Today's Fate.
 *
 * Deterministic-facts-first: the client computes `daily-facts-v1` and
 * `daily-domain-score-v2` from the visitor's OWN primary chart and sends
 * them here. The model never computes transits or scores — it only puts
 * the already-computed evidence into plain language.
 *
 * See skills/fate-nexus-daily-reading/SKILL.md for the contract.
 */
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardrailsFor } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";

export const DAILY_READING_VERSION = "daily-reading-v1";

const DomainInput = z.object({
  domain: z.string().max(24),
  label: z.string().max(40),
  score: z.number().int().min(0).max(100),
  band: z.string().max(24),
  confidence: z.string().max(16),
  evidence: z.array(z.string().max(120)).max(6).default([]),
});

/**
 * Sections are generated ON DEMAND, one small call per expanded module:
 * - "overview" → one_line_theme + narrative (the header card)
 * - "actions"  → do_today / observe_today / countercondition / reflection
 * - "domain"   → a single domain line + that domain's do/observe
 */
export const DAILY_READING_SECTIONS = ["overview", "actions", "domain"] as const;
export type DailyReadingSection = (typeof DAILY_READING_SECTIONS)[number];

const Input = z.object({
  lang: z.enum(["zh", "en"]).default("zh"),
  section: z.enum(DAILY_READING_SECTIONS).default("overview"),
  targetDomain: z.string().max(24).optional(),
  localDate: z.string().max(20),
  timezone: z.string().max(60),
  chartLabel: z.string().max(80).optional(),
  moonPhase: z.string().max(40).optional(),
  moonSign: z.number().int().min(0).max(11).optional(),
  retrogrades: z.array(z.string().max(20)).max(10).default([]),
  aspects: z.array(z.string().max(120)).max(24).default([]),
  overall: z.object({
    score: z.number().int().min(0).max(100),
    band: z.string().max(24),
    themeKeywords: z.array(z.string().max(60)).max(6).default([]),
  }),
  domains: z.array(DomainInput).max(8).default([]),
  contradictions: z.array(z.string().max(200)).max(4).default([]),
  missingFacts: z.array(z.string().max(60)).max(6).default([]),
  concern: z.string().max(40).optional(),
});

export type DailyReadingInput = z.input<typeof Input>;


export type DailyReadingAI = {
  version: string;
  one_line_theme: string;
  narrative: string;
  domain_lines: { domain: string; line: string }[];
  do_today: string[];
  observe_today: string[];
  countercondition: string;
  reflection_question: string;
};

function coerce(raw: unknown): DailyReadingAI {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown, n: number) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, n) as string[] : [];
  return {
    version: DAILY_READING_VERSION,
    one_line_theme: typeof o.one_line_theme === "string" ? o.one_line_theme : "",
    narrative: typeof o.narrative === "string" ? o.narrative : "",
    domain_lines: Array.isArray(o.domain_lines)
      ? (o.domain_lines as Record<string, unknown>[])
          .filter((x) => x && typeof x.domain === "string" && typeof x.line === "string")
          .map((x) => ({ domain: String(x.domain), line: String(x.line) }))
          .slice(0, 8)
      : [],
    do_today: arr(o.do_today, 3),
    observe_today: arr(o.observe_today, 3),
    countercondition: typeof o.countercondition === "string" ? o.countercondition : "",
    reflection_question:
      typeof o.reflection_question === "string" ? o.reflection_question : "",
  };
}

export const generateDailyReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<DailyReadingAI> => {
    enforceRateLimit(`daily-reading:${context.userId}`, 12, 60_000, "daily readings");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Daily reading service is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const isZh = data.lang === "zh";

    const facts = [
      `local_date: ${data.localDate} (${data.timezone})`,
      data.chartLabel && `chart: ${data.chartLabel}`,
      data.moonPhase && `daily.moon.phase: ${data.moonPhase}`,
      typeof data.moonSign === "number" && `daily.moon.sign: ${data.moonSign}`,
      data.retrogrades.length && `retrograde: ${data.retrogrades.join(", ")}`,
      data.aspects.length && `transit_to_natal_aspects:\n- ${data.aspects.join("\n- ")}`,
      `overall: ${data.overall.score}/100 band=${data.overall.band} keywords=${data.overall.themeKeywords.join(",") || "-"}`,
      `domains:\n${data.domains
        .map(
          (dd) =>
            `- ${dd.domain} (${dd.label}) ${dd.score}/100 band=${dd.band} confidence=${dd.confidence} evidence=${dd.evidence.join("; ") || "-"}`,
        )
        .join("\n")}`,
      data.contradictions.length && `contradictions: ${data.contradictions.join(" | ")}`,
      data.missingFacts.length && `missing_facts: ${data.missingFacts.join(", ")}`,
      data.concern && `user_concern: ${data.concern}`,
    ]
      .filter(Boolean)
      .join("\n");

    const system = isZh
      ? `你是「命运图书馆」的今日解读者。你**从不**计算行运、分数或周期，只解释上面已经算好的事实与分数。
硬性规则：
- 每一条结论都必须引用上面列出的具体相位、月相、逆行或领域分数，禁止通用模板句。
- 分数称为「今日领域信号 / 关注线索」，绝不能说成成功率、好运概率、胜率。
- 不保证任何事件发生；不预测灾病、生死、外遇、投资盈亏；不制造恐惧；不给幸运色/数字/方位。
- 不得编造八字日干支、紫微日盘、Nakshatra 日运。
- 必须含至少一条「如果现实情况不同，以现实为准」的反条件。
- 语气成熟克制，像烛下低语的馆员，不使用感叹号堆叠。
只输出严格 JSON，无前后缀、无 Markdown 代码块。`
      : `You are the Destiny Library's daily-reading explainer. You NEVER compute transits, scores, or cycles — you only explain the facts and scores given above.
Hard rules:
- Every statement must cite a concrete aspect, moon phase, retrograde, or domain score listed above. No generic templates.
- Call scores "today's domain signals" — never success rate, luck probability, or hit rate.
- No guaranteed events; no disaster/illness/death/affair/investment forecasts; no fear marketing; no lucky colours/numbers/directions.
- Never fabricate BaZi day pillars, Zi Wei day charts, or daily Nakshatra.
- Include at least one countercondition: if reality differs, reality wins.
- Tone: reserved, adult, candle-lit library.
Output STRICT JSON only — no prose, no code fences.

${guardrailsFor("en")}`;

    // Per-section schema: only the fields the expanded module needs, so each
    // call stays small (fewer tokens = lower cost, faster first paint).
    const target = data.targetDomain ?? "";
    const schemas: Record<DailyReadingSection, string> = isZh
      ? {
          overview: `{
  "one_line_theme": "≤ 22 字的今日主题，必须引用月相/逆行/最强相位之一",
  "narrative": "2-3 句，约 80-140 字，串起总体信号与最突出的两个领域，引用具体证据"
}`,
          actions: `{
  "do_today": ["≤ 24 字的具体动作", "…", "…"],
  "observe_today": ["≤ 24 字的观察点", "…", "…"],
  "countercondition": "一句反条件，例如「如果今天的实际安排与此不同，以现实为准」",
  "reflection_question": "一句自省提问"
}`,
          domain: `{
  "domain_lines": [ { "domain": "${target}", "line": "≤ 34 字，引用该领域的证据" } ],
  "narrative": "1-2 句，只讲 ${target} 这一个领域今天的信号与由来",
  "do_today": ["≤ 24 字，针对该领域的动作", "…"],
  "observe_today": ["≤ 24 字，针对该领域的观察点", "…"]
}`,
        }
      : {
          overview: `{
  "one_line_theme": "<= 12 words, citing moon phase / retrograde / strongest aspect",
  "narrative": "2-3 sentences tying the overall signal to the two most notable domains, citing evidence"
}`,
          actions: `{
  "do_today": ["concrete action", "…", "…"],
  "observe_today": ["thing to watch", "…", "…"],
  "countercondition": "one line: if reality differs, reality wins",
  "reflection_question": "one self-inquiry prompt"
}`,
          domain: `{
  "domain_lines": [ { "domain": "${target}", "line": "<= 18 words citing that domain's evidence" } ],
  "narrative": "1-2 sentences about the ${target} domain only",
  "do_today": ["action for this domain", "…"],
  "observe_today": ["thing to watch in this domain", "…"]
}`,
        };
    const schema = schemas[data.section];


    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      system,
      prompt: `${isZh ? "已算好的事实与分数" : "Pre-computed facts and scores"}:
${facts}

${isZh ? "严格按此 JSON schema 输出（只输出 JSON）" : "Output STRICTLY this JSON schema (JSON only)"}:
${schema}`,
    });

    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Daily reading returned no JSON");
    return coerce(JSON.parse(cleaned.slice(start, end + 1)));
  });
