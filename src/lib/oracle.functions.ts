import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AskInput = z.object({
  question: z.string().min(1),
  lang: z.enum(["en", "zh"]).default("zh"),
  // The user's four-tradition snapshot — kept short so the model can weave it in.
  chart: z
    .object({
      name: z.string().optional(),
      astrology: z.string().optional(),
      jyotish: z.string().optional(),
      bazi: z.string().optional(),
      ziwei: z.string().optional(),
    })
    .optional(),
});

export const askOracle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const chart = data.chart ?? {};
    const chartLine = [
      chart.name ? `Name: ${chart.name}` : null,
      chart.astrology ? `Western Astrology: ${chart.astrology}` : null,
      chart.jyotish ? `Jyotish: ${chart.jyotish}` : null,
      chart.bazi ? `BaZi: ${chart.bazi}` : null,
      chart.ziwei ? `Zi Wei Dou Shu: ${chart.ziwei}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system =
      data.lang === "zh"
        ? `你是「命运图书馆」中的一位古老智者，兼通西方占星、印度占星（Jyotish）、八字与紫微斗数。回答时要：
1) 温暖、诗意、有分量，像深夜烛下低声耳语；
2) 明确结合来访者的四个体系落位（若提供），交叉印证；
3) 给出 2–4 条可行动的建议，避免空泛；
4) 中文回答，200–320 字，段落之间用空行分隔，可用「1)」「2)」列点。
不要说自己是 AI，不要提示未来是命定的 —— 命运只是一张地图。`
        : `You are an ancient elder in the "Library of Destiny", fluent in Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. When you answer:
1) Warm, poetic, weighty — like a candle-lit whisper;
2) Explicitly weave in the visitor's four-tradition placements when provided, cross-referencing them;
3) Offer 2–4 actionable next moves, never vague;
4) English, 200–320 words, blank lines between paragraphs; numbered points are welcome.
Never claim to be an AI. Never say fate is fixed — destiny is only a map.`;

    const prompt = `${chartLine ? `Visitor's chart:\n${chartLine}\n\n` : ""}Question:\n${data.question}`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
    });

    return { text };
  });
