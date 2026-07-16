import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Elder companion chat — a tiny "tree hole" confidant for everyday worries.
 *
 * IMPORTANT: This surface is NOT for fortune-telling / chart interpretation.
 * The elder listens, gently reflects, and offers small grounding suggestions.
 * When the visitor's message contains device / order / payment keywords, we
 * record it as a `user_feedback` row so the team can follow up.
 */

const ChatInput = z.object({
  message: z.string().min(1).max(2000),
  lang: z.enum(["en", "zh"]).default("zh"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .default([]),
});

// Keyword sets — lowercase compared. Kept small & obvious so the mapping is
// predictable rather than "AI-guessed".
const DEVICE_KEYWORDS = [
  // zh
  "闪退", "崩溃", "卡顿", "卡死", "白屏", "黑屏", "打不开", "加载不出", "加载失败",
  "无法登录", "登不上", "登录不了", "报错", "bug", "错误", "页面空白", "刷不出",
  // en
  "crash", "crashed", "broken", "freeze", "frozen", "glitch", "cannot load",
  "can't load", "won't load", "error", "blank page", "white screen", "not working",
];

const ORDER_KEYWORDS = [
  // zh
  "订单", "付款", "支付", "退款", "扣费", "扣款", "发票", "收据", "会员", "订阅",
  "续费", "开通失败", "未到账", "价格", "涨价", "优惠", "券",
  // en
  "order", "payment", "paid", "refund", "charge", "charged", "billing", "invoice",
  "receipt", "subscription", "membership", "renew", "renewal", "price", "coupon",
];

type Category = "device" | "order" | "other";

function detectFeedback(text: string): { category: Category; hits: string[] } {
  const lower = text.toLowerCase();
  const deviceHits = DEVICE_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
  const orderHits = ORDER_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
  if (deviceHits.length === 0 && orderHits.length === 0) {
    return { category: "other", hits: [] };
  }
  // If both, weight by number of hits; prefer order (more actionable).
  if (orderHits.length >= deviceHits.length) {
    return { category: "order", hits: orderHits };
  }
  return { category: "device", hits: deviceHits };
}

export const elderChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ChatInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Feedback detection — record device/order concerns before replying.
    const detected = detectFeedback(data.message);
    let feedbackRecorded = false;
    if (detected.category !== "other") {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        category: detected.category,
        message: data.message.slice(0, 2000),
        keywords: detected.hits.slice(0, 12),
        lang: data.lang,
      });
      if (!error) feedbackRecorded = true;
    }

    // 2) Compose the elder's reply.
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const systemZh = `你是「命运图书馆」里一位温柔的智者，此刻扮演的是一个"小小的树洞"——不是命理师。
访客只是想吐槽、抒发情绪、或说说最近的小烦恼。请：
1) 用非常温柔、耐心、有陪伴感的口吻回应；像老朋友坐在旁边听。
2) 先"接住"情绪：确认、命名、共情，再轻轻回应。
3) 不要谈命盘、星座、八字、紫微、Jyotish、命运——这不是命理咨询。
4) 可以给 1–2 个非常小、非常具体、可操作的自我照顾建议（喝口温水、写下三件小事、深呼吸四拍）。
5) 若访客描述的是"设备/App 故障"或"订单/付款/会员"相关问题——请温柔地告知：已经把这条反馈同步到团队，请留意稍后回复；本次不代替客服。
6) 回复中文，60–160 字，段落清晰，可分 2 段；不要说自己是 AI。`;

    const systemEn = `You are a gentle elder inside the "Library of Destiny", playing the role of a small confidant / tree hole — NOT a fortune-teller.
The visitor just wants to vent or share a small worry. Please:
1) Warm, patient, present — like an old friend sitting next to them.
2) Acknowledge the feeling first: name it, empathise, then respond softly.
3) Do NOT talk about charts, astrology, BaZi, Zi Wei, Jyotish or fate — this is NOT a reading.
4) Offer 1–2 tiny, concrete self-care nudges (sip warm water, jot three small wins, breathe in 4 out 4).
5) If the visitor describes a "device / app issue" or "order / payment / membership" problem — gently tell them the note has been forwarded to the team and someone will follow up; you are not customer support tonight.
6) English, 60–160 words, clean short paragraphs; never claim to be an AI.`;

    const feedbackNudgeZh = `\n\n注意：本条消息包含"${detected.category === "device" ? "设备/故障" : "订单/付款"}"关键词，请务必在结尾加一句：已经把这个问题记到反馈里，团队会尽快联系你。`;
    const feedbackNudgeEn = `\n\nNote: this message contains ${detected.category === "device" ? "device/bug" : "order/payment"} keywords — please end with one sentence letting them know the note has been forwarded to the team.`;

    let system = data.lang === "zh" ? systemZh : systemEn;
    if (feedbackRecorded) {
      system += data.lang === "zh" ? feedbackNudgeZh : feedbackNudgeEn;
    }

    const messages = [
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.message },
    ];

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      messages,
    });

    return {
      text,
      feedback: feedbackRecorded
        ? { recorded: true as const, category: detected.category }
        : { recorded: false as const },
    };
  });
