import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ask_oracle",
  title: "Ask the Library's oracle",
  description:
    "Ask the Library of Destiny's four-tradition oracle (Western astrology, Vedic Jyotish, BaZi, Zi Wei Dou Shu) a life question and receive a poetic, actionable answer. Optionally provide the visitor's chart snapshot to ground the answer.",
  inputSchema: {
    question: z.string().min(1).describe("The life question to ask."),
    lang: z
      .enum(["en", "zh"])
      .optional()
      .describe("Answer language. Defaults to English."),
    name: z.string().optional().describe("Visitor's name."),
    astrology: z.string().optional().describe("Western astrology snapshot (sun/moon/rising, key placements)."),
    jyotish: z.string().optional().describe("Vedic Jyotish snapshot (Nakshatra / Dashā)."),
    bazi: z.string().optional().describe("BaZi four pillars (year/month/day/hour)."),
    ziwei: z.string().optional().describe("Zi Wei Dou Shu palace snapshot."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { content: [{ type: "text", text: "Server is missing LOVABLE_API_KEY" }], isError: true };
    }

    const isZh = input.lang === "zh";
    const chart = {
      name: input.name,
      astrology: input.astrology,
      jyotish: input.jyotish,
      bazi: input.bazi,
      ziwei: input.ziwei,
    };
    const chartLine = [
      chart.name ? `Name: ${chart.name}` : null,
      chart.astrology ? `Western Astrology: ${chart.astrology}` : null,
      chart.jyotish ? `Jyotish: ${chart.jyotish}` : null,
      chart.bazi ? `BaZi: ${chart.bazi}` : null,
      chart.ziwei ? `Zi Wei Dou Shu: ${chart.ziwei}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system = isZh
      ? "你是「命运图书馆」中的一位古老智者，兼通西方占星、印度占星、八字与紫微斗数。回答温暖、诗意、克制，200–320 字，若提供命盘请交叉印证并给 2–4 条可行建议。不要自称 AI。"
      : "You are an ancient elder in the Library of Destiny, fluent in Western Astrology, Vedic Jyotish, BaZi and Zi Wei Dou Shu. Warm, poetic, restrained — 200–320 words. Weave in any chart snapshot provided, cross-referencing, and end with 2–4 actionable moves. Never claim to be an AI.";
    const prompt = `${chartLine ? `Visitor's chart:\n${chartLine}\n\n` : ""}Question:\n${input.question}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        content: [{ type: "text", text: `Oracle call failed (${res.status}): ${text.slice(0, 400)}` }],
        isError: true,
      };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = body.choices?.[0]?.message?.content ?? "";
    return {
      content: [{ type: "text", text: answer }],
      structuredContent: { answer },
    };
  },
});
