import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";

const EventInput = z.object({
  id: z.string().max(64),
  event: z.string().min(1).max(400),
  rangeStart: z.union([z.string().max(20), z.number()]).optional(),
  rangeEnd: z.union([z.string().max(20), z.number()]).optional(),
});

const ChartInput = z.object({
  name: z.string().max(120).optional(),
  date: z.string().max(40).optional(),
  time: z.string().max(20).optional(),
  place: z.string().max(160).optional(),
  bazi: z.string().max(120).optional(),
  zodiac: z.string().max(40).optional(),
  lunar: z.string().max(80).optional(),
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
  lang: z.enum(["en", "zh"]).default("zh"),
});

const InferInput = ChartInput.extend({
  events: z.array(EventInput).min(1).max(20),
});

export type InferredEvent = {
  id: string;
  when: string; // e.g. "2023 年 6–8 月" or "spring 2023"
  reasoning: string; // 3-5 sentences citing the four traditions
};

function chartFacts(data: z.infer<typeof ChartInput>) {
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
    data.bazi && `BaZi pillars: ${data.bazi}`,
    planetLines && `Western placements: ${planetLines}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function stripJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const f = cleaned.indexOf("{");
  const l = cleaned.lastIndexOf("}");
  const a = cleaned.indexOf("[");
  // Prefer whichever wrapper appears first, extract to last matching bracket.
  if (a >= 0 && (f < 0 || a < f)) {
    const la = cleaned.lastIndexOf("]");
    if (la > a) return cleaned.slice(a, la + 1);
  }
  if (f >= 0 && l > f) return cleaned.slice(f, l + 1);
  return cleaned;
}

export const inferKeyEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InferInput.parse(d))
  .handler(async ({ data, context }): Promise<{ results: InferredEvent[] }> => {
    enforceRateLimit(`key-infer:${context.userId}`, 15, 60_000, "key-event inferences");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Key-event service is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const isZh = data.lang === "zh";

    const system = (isZh
      ? `你是精通西方占星、印度占星（Jyotish）、八字与紫微斗数的老者。用户会告诉你他人生真实发生过的一件事（比如「分手」「骨折」「换城市」）以及大致年份范围。你的任务：只依据下面这张命盘，从四个体系中交叉推演，落到一个尽量具体的时间点（月份或季度），并简要说明每个体系提供了什么线索。语气克制、诚实、可验证。只输出严格合法 JSON，不要 Markdown。`
      : `You are an elder fluent in Western astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. The visitor will tell you a real life event (breakup, fracture, move…) and an approximate year range. Grounded only in the chart below, cross-read the four traditions and land on the most specific time you can (month or quarter). Briefly state what each tradition contributed. Restrained, honest, verifiable. STRICT JSON only, no Markdown.`)
      + "\n\n" + guardrailsFor(isZh ? "zh" : "en");

    const schema = `{
  "results": [
    {
      "id": "matches the incoming event id",
      "when": ${isZh ? '"具体年月或季度，例如：2023 年 6–8 月"' : '"specific year+month or quarter, e.g. Jun–Aug 2023"'},
      "reasoning": ${isZh ? '"3–5 句，依次点出西方/印度/八字/紫微中最能锁定这段时间的线索"' : '"3–5 sentences: name the Western, Vedic, BaZi and Zi Wei signals that lock this window"'}
    }
  ]
}`;

    const eventsBlock = data.events
      .map(
        (e) =>
          `- id=${e.id} · ${isZh ? "事件" : "event"}: ${e.event} · ${isZh ? "范围" : "range"}: ${e.rangeStart ?? "?"}–${e.rangeEnd ?? "?"}`,
      )
      .join("\n");

    const prompt = `${isZh ? "命盘事实" : "Chart facts"}:
${chartFacts(data) || (isZh ? "（缺）" : "(missing)")}

${isZh ? "用户提交的事件" : "Events submitted"}:
${eventsBlock}

${isZh ? "严格按此 schema 输出：" : "Output strictly matches this schema:"}
${schema}`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
    });
    const json = stripJson(text);
    let parsed: { results?: InferredEvent[] };
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error(`inferKeyEvents JSON parse failed: ${(err as Error).message}`);
    }
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    // Fill in any missing entries so the UI never breaks.
    const byId = new Map(results.map((r) => [r.id, r]));
    return {
      results: data.events.map(
        (e) =>
          byId.get(e.id) ?? {
            id: e.id,
            when: isZh ? "暂无法锁定" : "cannot lock yet",
            reasoning: isZh ? "命盘信号不足以给出具体时点。" : "The chart signals were insufficient.",
          },
      ),
    };
  });

const SynthInput = ChartInput.extend({
  events: z
    .array(
      z.object({
        event: z.string().max(400),
        rangeStart: z.union([z.string().max(20), z.number()]).optional(),
        rangeEnd: z.union([z.string().max(20), z.number()]).optional(),
        aiWhen: z.string().max(120).optional(),
        aiReasoning: z.string().max(1200).optional(),
        accurate: z.enum(["yes", "no", "unset"]).default("unset"),
        userCorrection: z.string().max(600).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const synthesizeKeyEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SynthInput.parse(d))
  .handler(async ({ data, context }): Promise<{ synthesis: string }> => {
    enforceRateLimit(`key-synth:${context.userId}`, 10, 60_000, "key-event syntheses");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Key-event service is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const isZh = data.lang === "zh";

    const system = (isZh
      ? `你是"命运图书馆"的老者。用户已验证或纠正了 AI 对若干关键节点的判定。请把这些真实反馈作为微调依据，重新审视这张命盘，写一段 4–6 段的"综合判断"：
1) 明确指出 AI 哪里判对了、哪里偏差、偏差意味着这张盘的哪个体系需要重新加权；
2) 结合被验证过的真实时间点，给出这个人未来 3 年的三个"最值得留意的窗口"（月份精度），并说明理由；
3) 用温暖、诗意但不空洞的中文，200–320 字。禁止套话。`
      : `You are the elder of the Library of Destiny. The user has verified or corrected the AI's guesses on their key life events. Use those real anchors to recalibrate the chart and write a 4–6 paragraph "final synthesis":
1) State clearly where the AI was right, where it drifted, and which tradition's weight should be adjusted because of that drift;
2) Using the verified anchors, name three concrete windows (month-precision) in the next 3 years that deserve attention, and why;
3) Warm, poetic but concrete, 200–320 words. No filler.`)
      + "\n\n" + guardrailsFor(isZh ? "zh" : "en");

    const eventsBlock = data.events
      .map((e, i) => {
        const lines = [
          `#${i + 1} ${isZh ? "事件" : "event"}: ${e.event}`,
          `${isZh ? "用户范围" : "user range"}: ${e.rangeStart ?? "?"}–${e.rangeEnd ?? "?"}`,
          e.aiWhen ? `${isZh ? "AI 推测" : "AI guess"}: ${e.aiWhen}` : null,
          e.aiReasoning ? `${isZh ? "AI 依据" : "AI reasoning"}: ${e.aiReasoning}` : null,
          `${isZh ? "用户判定" : "user verdict"}: ${e.accurate}`,
          e.userCorrection ? `${isZh ? "用户纠正" : "user correction"}: ${e.userCorrection}` : null,
        ].filter(Boolean);
        return lines.join("\n");
      })
      .join("\n\n");

    const prompt = `${isZh ? "命盘事实" : "Chart facts"}:
${chartFacts(data) || (isZh ? "（缺）" : "(missing)")}

${isZh ? "已验证的关键节点" : "Verified key events"}:
${eventsBlock}`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
    });
    return { synthesis: text.trim() };
  });
