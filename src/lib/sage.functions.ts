import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import { classifyIntent, type Intent } from "./intent-router";

/**
 * Unified Sage Companion server function.
 *
 * All conversational chat traffic (except the paid Oracle reading room)
 * routes through here. The intent router runs FIRST so out-of-scope,
 * crisis, destiny-reading, product-help, and order-help messages never
 * reach the model.
 *
 * Return shape is stable:
 *   { intent, text, usedAi, usedChart, chargedQuota, nextAction, feedbackTicket? }
 * The UI relies on this to render mode banners and CTAs.
 */

const SageChatInput = z.object({
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
  // Reserved for future features (companion vs oracle-companion mode).
  mode: z.enum(["companion"]).default("companion"),
  // Idempotency hint from the client — future work can dedupe replays.
  requestId: z.string().max(80).optional(),
});

export type SageNextAction =
  | { kind: "none" }
  | { kind: "enter_oracle"; href: string; source: "companion" }
  | { kind: "upgrade_oracle"; source: "companion" }
  | { kind: "open_route"; href: string; label: { zh: string; en: string } }
  | { kind: "crisis_support" }
  | {
      kind: "confirm_ticket_draft";
      draft: {
        category: "product" | "device" | "order" | "payment" | "subscription";
        subject: string;
        message: string;
      };
    };

export type SageChatResponse = {
  intent: Intent;
  text: string;
  usedAi: boolean;
  usedChart: boolean;
  chargedQuota: boolean;
  nextAction: SageNextAction;
};

// ------------------------------------------------------------------
// Fixed responses (no AI, deterministic, translation-owned by us).
// ------------------------------------------------------------------

const CRISIS_TEXT: Record<"en" | "zh", string> = {
  zh:
    "我听到你了。你现在的感觉很重要，你不必一个人扛。请立刻联系可以陪你说话的专业支持：\n\n" +
    "· 中国心理援助热线（24小时）：北京心理危机 010-82951332，全国 400-161-9995\n" +
    "· 若你此刻可能伤害自己或他人，请立刻拨打 120 或就近前往急诊。\n\n" +
    "此刻我不为你解读命运。你的安全比任何星象都重要。",
  en:
    "I hear you. What you're feeling matters, and you don't have to carry this alone. " +
    "Please reach out to someone trained to be with you right now:\n\n" +
    "· United States: 988 Suicide & Crisis Lifeline (call or text 988)\n" +
    "· United Kingdom & Ireland: Samaritans 116 123\n" +
    "· If you might hurt yourself or someone else, please call your local emergency number now.\n\n" +
    "I won't offer a reading tonight. Your safety matters more than any chart.",
};

const OUT_OF_SCOPE_TEXT: Record<"en" | "zh", string> = {
  zh: "这里专注于陪你理解自己的处境、阅读你授权的命盘，以及处理产品与订单问题。这个问题不在智者能解读的范围内。",
  en: "This companion is for understanding your own moment, reading charts you've authorised, and helping with product / order questions. That request isn't something the Sage can answer here.",
};

function destinyResponse(
  lang: "en" | "zh",
  hasActiveOracle: boolean,
): { text: string; next: SageNextAction } {
  if (hasActiveOracle) {
    return {
      text:
        lang === "zh"
          ? "命理解读需要在「神谕者阅读室」里做，那里可以选择要读的命盘并显式确认。我在这里只做陪伴与产品支持。"
          : "Reading a chart happens in the Oracle Reading Room, where you can pick which chart to open and confirm it explicitly. I'm only your companion here.",
      next: { kind: "enter_oracle", href: "/me/oracle?source=companion", source: "companion" },
    };
  }
  return {
    text:
      lang === "zh"
        ? "解读命盘是神谕者的能力。我这里只做陪伴与产品支持——不会读盘、也不会代替神谕者回答。"
        : "Reading a chart is an Oracle-tier capability. I only offer companionship and product help here — I won't read a chart, and I won't stand in for the Oracle.",
    next: { kind: "upgrade_oracle", source: "companion" },
  };
}

// A tiny keyword-driven FAQ. Falls back to a "here's where to look" line.
function productHelpAnswer(
  msg: string,
  lang: "en" | "zh",
): {
  text: string;
  next: SageNextAction;
} {
  const lower = msg.toLowerCase();
  const zh = lang === "zh";
  const like = (arr: string[]) => arr.some((k) => lower.includes(k.toLowerCase()));

  if (like(["登录", "登陆", "login", "sign in", "log in", "password", "密码"])) {
    return {
      text: zh
        ? "登录入口在页面右上角的「进入图书馆」，也可以直接访问 /auth。忘记密码可以在登录页选择「重置密码」。"
        : "The sign-in entry is at the top-right (Enter the Library) or at /auth. If you've forgotten your password, use Reset password on the sign-in page.",
      next: {
        kind: "open_route",
        href: "/auth",
        label: { zh: "打开登录页", en: "Open sign-in" },
      },
    };
  }
  if (like(["报告", "report", "生成", "generate", "download"])) {
    return {
      text: zh
        ? "免费的每日阅览与主题回应在「今日命运」里；一次性的 ¥79 高级综合报告在报告页生成。这是每张命盘一次的永久购买。"
        : "Your free daily reading and thematic responses live in Today's Room. The one-time ¥79 Premium Deep Reading is generated on the report page — it's a permanent, per-chart purchase.",
      next: {
        kind: "open_route",
        href: "/me/home",
        label: { zh: "去今日命运", en: "Open Today's Room" },
      },
    };
  }
  if (like(["会员", "membership", "subscription", "sage", "oracle", "神谕", "贤者"])) {
    return {
      text: zh
        ? "月度会员分「贤者」与「神谕者」，到期后自动降级；不会未经确认扣款。¥79 高级综合报告是一次性、每张命盘一份、永久保存，与会员相互独立。"
        : "Monthly memberships come in Sage and Oracle tiers and lapse back automatically at expiry — no silent renewal. The one-time ¥79 Premium Deep Reading is per chart, kept forever, and independent of the membership tier.",
      next: {
        kind: "open_route",
        href: "/me/profile",
        label: { zh: "查看会员", en: "View my membership" },
      },
    };
  }
  return {
    text: zh
      ? "如果告诉我是哪一步遇到问题（登录、生成报告、会员或命盘），我可以给出更精确的指引。"
      : "If you tell me which step is giving you trouble (sign-in, generating a report, membership, or a chart), I can point you exactly where to look.",
    next: { kind: "none" },
  };
}

function orderHelpAnswer(
  hasFeedback: boolean,
  ticketId: string | null,
  lang: "en" | "zh",
): { text: string; next: SageNextAction } {
  const zh = lang === "zh";
  if (hasFeedback && ticketId) {
    return {
      text: zh
        ? `已把这条反馈记入后台（工单号 ${ticketId.slice(0, 8)}）。你可以在「我的会员」页查看你名下的订单；如需人工跟进，请告诉我订单号。`
        : `Your note has been filed (ticket ${ticketId.slice(0, 8)}). You can review your orders on the membership page; if you need a human to follow up, please share the order number.`,
      next: { kind: "provide_order_id" },
    };
  }
  return {
    text: zh
      ? "为了保护你的账户，我不会替你调阅陌生订单。请把订单号或注册邮箱发过来，我会指引下一步；或者在「我的会员」页直接查看你名下的订单。"
      : "To protect your account, I won't look up unfamiliar orders. Share the order number or the email you signed up with and I'll point you to the next step; or check your own orders on the membership page.",
    next: { kind: "provide_order_id" },
  };
}

async function emotionalReply(
  message: string,
  lang: "en" | "zh",
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Companion service is not configured");
  const gateway = createLovableAiGatewayProvider(key);

  const systemZh = `你是「命运图书馆」里一位温柔的智者，此刻是一个"小小的陪伴"——不是命理师。
访客只是想吐槽、抒发情绪或说说最近的小烦恼。请：
1) 用非常温柔、耐心、有陪伴感的口吻回应；像老朋友坐在旁边听。
2) 先"接住"情绪：确认、命名、共情，再轻轻回应。
3) 不要谈命盘、星座、八字、紫微、Jyotish、命运——这不是命理咨询。
4) 可以给 1–2 个非常小、非常具体、可操作的自我照顾建议。
5) 回复中文，60–160 字，段落清晰；不要说自己是 AI。`;
  const systemEn = `You are a gentle elder inside the "Library of Destiny", playing the role of a small companion — NOT a fortune-teller.
The visitor just wants to vent or share a small worry. Please:
1) Warm, patient, present — like an old friend sitting next to them.
2) Acknowledge the feeling first: name it, empathise, then respond softly.
3) Do NOT talk about charts, astrology, BaZi, Zi Wei, Jyotish or fate — this is NOT a reading.
4) Offer 1–2 tiny, concrete self-care nudges.
5) English, 60–160 words; never claim to be an AI.`;
  const system = (lang === "zh" ? systemZh : systemEn) + "\n\n" + guardrailsFor(lang);

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const { text } = await generateText({
    model: gateway("google/gemini-2.5-flash"),
    system,
    messages,
  });
  return text;
}

export const sageChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SageChatInput.parse(data))
  .handler(async ({ data, context }): Promise<SageChatResponse> => {
    const { supabase, userId } = context;
    enforceRateLimit(`sage-chat:${userId}`, 20, 60_000, "messages");

    const { intent } = classifyIntent(data.message);

    // 1) Crisis — never call AI, never store the raw message.
    if (intent === "crisis") {
      return {
        intent,
        text: CRISIS_TEXT[data.lang],
        usedAi: false,
        usedChart: false,
        chargedQuota: false,
        nextAction: { kind: "crisis_support" },
      };
    }

    // 2) Destiny reading — hand off to Oracle, respect real entitlement.
    if (intent === "destiny_reading") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_tier, membership_expires_at")
        .eq("id", userId)
        .maybeSingle();
      const tier = (profile?.membership_tier ?? "none") as string;
      const exp = profile?.membership_expires_at
        ? new Date(profile.membership_expires_at as string)
        : null;
      const active = tier === "oracle" && !!exp && exp.getTime() > Date.now();
      const { text, next } = destinyResponse(data.lang, active);
      return {
        intent,
        text,
        usedAi: false,
        usedChart: false,
        chargedQuota: false,
        nextAction: next,
      };
    }

    // 3) Out of scope — refuse cleanly.
    if (intent === "out_of_scope") {
      return {
        intent,
        text: OUT_OF_SCOPE_TEXT[data.lang],
        usedAi: false,
        usedChart: false,
        chargedQuota: false,
        nextAction: { kind: "none" },
      };
    }

    // 4) Product help — FAQ lookup, no AI.
    if (intent === "product_help") {
      const { text, next } = productHelpAnswer(data.message, data.lang);
      return {
        intent,
        text,
        usedAi: false,
        usedChart: false,
        chargedQuota: false,
        nextAction: next,
      };
    }

    // 5) Order help — record a real ticket, only claim what actually happened.
    if (intent === "order_help") {
      let ticket: { id: string; category: "order" } | undefined;
      try {
        const summary = data.message.slice(0, 200);
        const { data: inserted } = await supabase
          .from("user_feedback")
          .insert({
            user_id: userId,
            category: "order",
            message: summary,
            keywords: [],
            lang: data.lang,
          })
          .select("id")
          .maybeSingle();
        if (inserted?.id) ticket = { id: String(inserted.id), category: "order" };
      } catch {
        // Ignore — the reply below still works without a ticket id.
      }
      const { text, next } = orderHelpAnswer(!!ticket, ticket?.id ?? null, data.lang);
      return {
        intent,
        text,
        usedAi: false,
        usedChart: false,
        chargedQuota: false,
        nextAction: next,
        feedbackTicket: ticket,
      };
    }

    // 6) Emotional support — the only path that uses the model.
    try {
      const text = await emotionalReply(data.message, data.lang, data.history);
      return {
        intent,
        text,
        usedAi: true,
        usedChart: false,
        chargedQuota: false,
        nextAction: { kind: "none" },
      };
    } catch (err) {
      throw new Error(safeMessage(err, "Companion is unavailable"));
    }
  });
