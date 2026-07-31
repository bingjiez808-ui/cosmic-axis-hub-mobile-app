/**
 * 历代先贤 · Council of Sages — server-only implementation.
 *
 * Three answering routes live here:
 *   sage      — a distilled historical persona answers via the AI gateway
 *   librarian — the letter lands on the librarian's (admin) desk
 *   assignment— the librarian hands a letter to an opted-in traveler
 *
 * Every privileged write goes through a SECURITY DEFINER RPC that re-checks
 * authorship, admin role and credits inside Postgres. Letter bodies are never
 * logged. Membership gating for the sage route is enforced here AND re-checked
 * against `profiles.membership_tier` before the model is called.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { hallError } from "./community-hall-errors";
import {
  needsSupportResources,
  riskLevel,
  safetyCode,
  screenCommunityText,
  type AgeBand,
} from "./community-hall-safety";
import { enforceRateLimit } from "./rate-limit.server";
import { findSagePersona, type SagePersona } from "./sage-personas";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

const SAGE_MODEL = "google/gemini-2.5-flash";

function friendly(error: { message?: string } | null): never {
  const raw = error?.message ?? "";
  if (raw.includes("no_human_reply_credits")) throw hallError("not_allowed");
  if (raw.includes("assignee_not_accepting")) throw hallError("not_allowed");
  if (raw.includes("not_allowed")) throw hallError("not_allowed");
  if (raw.includes("letter_not_found")) throw hallError("letter_not_found");
  if (raw.includes("auth_required")) throw hallError("auth_required");
  throw hallError("unknown");
}

function limit(key: string, max: number, windowMs: number) {
  try {
    enforceRateLimit(key, max, windowMs, key);
  } catch {
    throw hallError("rate_limited");
  }
}

// ------------------------------------------------------------------
// Membership
// ------------------------------------------------------------------

export type SageEntitlement = {
  tier: string;
  entitled: boolean;
  credits: { granted: number; used: number; remaining: number };
};

async function readTier(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("profiles")
    .select("membership_tier, membership_expires_at")
    .eq("id", ctx.userId)
    .maybeSingle();
  const tier = data?.membership_tier ?? "none";
  const exp = data?.membership_expires_at ? new Date(data.membership_expires_at).getTime() : 0;
  const active = exp > Date.now();
  return { tier, entitled: active && (tier === "sage" || tier === "oracle") };
}

export async function readSageEntitlement(ctx: Ctx): Promise<SageEntitlement> {
  const [{ tier, entitled }, credits] = await Promise.all([readTier(ctx), readCredits(ctx)]);
  return { tier, entitled, credits };
}

async function readCredits(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("get_sage_reply_credits");
  if (error) friendly(error);
  const raw = (data ?? {}) as { granted?: number; used?: number; remaining?: number };
  return {
    granted: Number(raw.granted ?? 0),
    used: Number(raw.used ?? 0),
    remaining: Number(raw.remaining ?? 0),
  };
}

// ------------------------------------------------------------------
// Prompt construction
// ------------------------------------------------------------------

function buildSystemPrompt(persona: SagePersona, lang: "zh" | "en") {
  const lines = [
    lang === "zh"
      ? `你以${persona.name.zh}（${persona.era.zh}）的身份回信。此人已故，你是在依据其著作与生平"以其口吻"作答，而不是冒充在世者。`
      : `You answer as ${persona.name.en} (${persona.era.en}). This person is long dead; you are reading their surviving work and life in their voice, not impersonating a living individual.`,
    "",
    lang === "zh" ? "【生平可援引】" : "[Life you may draw on]",
    ...persona.life.map((l) => `- ${l}`),
    "",
    lang === "zh" ? "【思想主张】" : "[What you actually argued]",
    ...persona.principles.map((l) => `- ${l}`),
    "",
    lang === "zh" ? "【语气】" : "[Voice]",
    persona.voice,
    "",
    lang === "zh" ? "【禁止】" : "[Never]",
    ...persona.avoid.map((l) => `- ${l}`),
    "",
    lang === "zh" ? "【回信规则】" : "[Letter rules]",
    lang === "zh"
      ? [
          "1. 这是一封信，不是咨询报告：不用小标题、不用列点清单，除非你本人本就那样写（如曾国藩的日课可列三条）。",
          "2. 先复述你听到的处境（一两句，具体，不泛泛），让对方确认被听见。",
          "3. 引一段你自己的经历或一句你自己的话，说明你为何懂这件事。",
          "4. 给出一个当下可做、明天能验证的具体动作或视角转换。",
          "5. 不预测命运、不算命、不承诺结果、不提供医疗或法律建议。",
          "6. 若对方透露自伤、伤人或紧急危险，不解答问题，只以你的语气劝其立刻联系身边的人与专业求助，并说明这封信不能替代求助。",
          "7. 长度 250–450 字，落款只写你的名字。",
        ].join("\n")
      : [
          "1. This is a letter, not a consulting report: no headings, no bullet checklists unless you historically wrote that way.",
          "2. Begin by restating the situation you heard, concretely, in a sentence or two.",
          "3. Draw on one episode of your own life or one line of your own writing, and say why you understand this.",
          "4. Offer one concrete act or shift the writer can test by tomorrow.",
          "5. Never predict fate, never promise outcomes, never give medical or legal advice.",
          "6. If the writer signals self-harm, harm to others, or emergency danger, do not answer the question: in your own voice urge them to reach a person beside them and professional help now, and say this letter cannot replace that.",
          "7. 200–350 words. Sign only with your name.",
        ].join("\n"),
  ];
  return lines.join("\n");
}

function buildUserPrompt(
  input: { subject?: string | null; body: string; topic?: string | null },
  lang: "zh" | "en",
) {
  const parts = [
    lang === "zh" ? "一位匿名旅者的来信：" : "A letter from an anonymous traveler:",
    input.subject ? (lang === "zh" ? `题：${input.subject}` : `Subject: ${input.subject}`) : "",
    input.topic ? (lang === "zh" ? `所属之事：${input.topic}` : `Topic: ${input.topic}`) : "",
    "",
    input.body,
  ];
  return parts.filter(Boolean).join("\n");
}

// ------------------------------------------------------------------
// Ask a sage
// ------------------------------------------------------------------

export type SageAskResult = {
  letterId: string;
  personaId: string;
  reply: string | null;
  pendingReview: boolean;
  showSupport: boolean;
  credits: SageEntitlement["credits"];
};

export async function askSage(
  ctx: Ctx,
  input: {
    personaId: string;
    subject?: string | null;
    body: string;
    topic?: string | null;
    targetAgeBand: AgeBand;
    lang: "zh" | "en";
  },
): Promise<SageAskResult> {
  const persona = findSagePersona(input.personaId);
  if (!persona) throw hallError("not_allowed");

  const { entitled } = await readTier(ctx);
  if (!entitled) throw hallError("not_allowed");

  limit(`sage-council:ask:${ctx.userId}`, 12, 24 * 60 * 60_000);

  const verdict = screenCommunityText(`${input.subject ?? ""}\n${input.body}`);
  if (verdict.action === "block") throw hallError(safetyCode(verdict.categories));
  const risk = riskLevel(verdict);
  const held = risk !== "none";

  const { data: letterId, error } = await ctx.supabase.rpc("send_community_letter", {
    _subject: input.subject ?? "",
    _body: input.body,
    _topic: input.topic ?? "",
    _target_age_band: input.targetAgeBand,
    _response_style: "",
    _needs_review: held,
    _risk_level: risk,
    _visibility: "delivered_only",
    _route: "sage",
    _persona_id: persona.id,
  });
  if (error || !letterId) friendly(error);

  let reply: string | null = null;
  if (!held) {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw hallError("unknown");
    const gateway = createLovableAiGatewayProvider(apiKey);
    try {
      const { text } = await generateText({
        model: gateway(SAGE_MODEL),
        system: buildSystemPrompt(persona, input.lang),
        prompt: buildUserPrompt(input, input.lang),
      });
      reply = text.trim();
    } catch {
      throw hallError("unknown");
    }
    const { error: recordError } = await ctx.supabase.rpc("record_sage_reply", {
      _letter_id: letterId as string,
      _persona_id: persona.id,
      _body: reply,
    });
    if (recordError) friendly(recordError);
  }

  return {
    letterId: letterId as string,
    personaId: persona.id,
    reply,
    pendingReview: held,
    showSupport: needsSupportResources(verdict),
    credits: await readCredits(ctx),
  };
}

// ------------------------------------------------------------------
// Letters to the librarian
// ------------------------------------------------------------------

export async function sendLibrarianLetter(
  ctx: Ctx,
  input: {
    subject?: string | null;
    body: string;
    topic?: string | null;
    targetAgeBand: AgeBand;
    responseStyle?: string | null;
  },
) {
  limit(`sage-council:librarian:${ctx.userId}`, 3, 24 * 60 * 60_000);
  const verdict = screenCommunityText(`${input.subject ?? ""}\n${input.body}`);
  if (verdict.action === "block") throw hallError(safetyCode(verdict.categories));
  const risk = riskLevel(verdict);
  const held = risk !== "none";

  const { data: letterId, error } = await ctx.supabase.rpc("send_community_letter", {
    _subject: input.subject ?? "",
    _body: input.body,
    _topic: input.topic ?? "",
    _target_age_band: input.targetAgeBand,
    _response_style: input.responseStyle ?? "",
    _needs_review: held,
    _risk_level: risk,
    _visibility: "delivered_only",
    _route: "librarian",
    _persona_id: "",
  });
  if (error || !letterId) friendly(error);
  return {
    letterId: letterId as string,
    pendingReview: held,
    showSupport: needsSupportResources(verdict),
  };
}

// ------------------------------------------------------------------
// Desk reads
// ------------------------------------------------------------------

export type DeskReply = {
  replyId: string;
  body: string;
  authorKind: "traveler" | "sage" | "librarian";
  personaId: string | null;
  createdAt: string;
};

export type DeskLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  route: string;
  personaId: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  replies: DeskReply[];
  assignment: { status: string; createdAt: string } | null;
};

export async function readDeskLetters(ctx: Ctx, route: "sage" | "librarian"): Promise<DeskLetter[]> {
  const { data, error } = await ctx.supabase.rpc("get_my_desk_letters", { _route: route });
  if (error) friendly(error);
  return (data ?? []) as unknown as DeskLetter[];
}

export type AssignedLetter = {
  assignmentId: string;
  status: string;
  note: string | null;
  createdAt: string;
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  expiresAt: string;
  author: { alias: string | null; ageBand: string | null };
  iReplied: boolean;
};

export async function readMyAssignments(ctx: Ctx): Promise<AssignedLetter[]> {
  const { data, error } = await ctx.supabase.rpc("get_my_letter_assignments");
  if (error) friendly(error);
  return (data ?? []) as unknown as AssignedLetter[];
}

export async function respondToAssignment(ctx: Ctx, assignmentId: string, accept: boolean) {
  limit(`sage-council:assign-respond:${ctx.userId}`, 30, 60 * 60_000);
  const { data, error } = await ctx.supabase.rpc("respond_letter_assignment", {
    _assignment_id: assignmentId,
    _accept: accept,
  });
  if (error) friendly(error);
  return { status: (data as string) ?? (accept ? "accepted" : "declined") };
}

/** Spend one of the three monthly human-reply grants: move the letter to the librarian. */
export async function requestHumanReply(ctx: Ctx, letterId: string) {
  limit(`sage-council:human:${ctx.userId}`, 6, 24 * 60 * 60_000);
  const { data, error } = await ctx.supabase.rpc("request_human_reply", { _letter_id: letterId });
  if (error) friendly(error);
  const raw = (data ?? {}) as { granted?: number; used?: number; remaining?: number };
  return {
    granted: Number(raw.granted ?? 0),
    used: Number(raw.used ?? 0),
    remaining: Number(raw.remaining ?? 0),
  };
}

// ------------------------------------------------------------------
// Librarian desk (admin)
// ------------------------------------------------------------------

export type LibrarianLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  targetAgeBand: string;
  status: string;
  createdAt: string;
  author: { alias: string | null; ageBand: string | null };
  replyCount: number;
  assignments: Array<{
    assignmentId: string;
    assigneeId: string;
    status: string;
    alias: string | null;
    createdAt: string;
  }>;
};

export type LibrarianHelper = {
  userId: string;
  alias: string | null;
  ageBand: string | null;
  academy: string | null;
  element: string | null;
  quote: string | null;
  language: string | null;
  assignedCount: number;
  acceptedCount: number;
  repliedCount: number;
  declinedCount: number;
  pendingCount: number;
  lastAssignedAt: string | null;
};

export async function readLibrarianDesk(ctx: Ctx) {
  const [letters, helpers] = await Promise.all([
    ctx.supabase.rpc("librarian_list_letters"),
    ctx.supabase.rpc("librarian_list_helpers"),
  ]);
  if (letters.error) friendly(letters.error);
  if (helpers.error) friendly(helpers.error);
  return {
    letters: (letters.data ?? []) as unknown as LibrarianLetter[],
    helpers: (helpers.data ?? []) as unknown as LibrarianHelper[],
  };
}

export async function assignLetter(
  ctx: Ctx,
  input: { letterId: string; assigneeId: string; note?: string | null },
) {
  limit(`sage-council:assign:${ctx.userId}`, 60, 60 * 60_000);
  const { data, error } = await ctx.supabase.rpc("librarian_assign_letter", {
    _letter_id: input.letterId,
    _assignee: input.assigneeId,
    _note: input.note ?? "",
  });
  if (error) friendly(error);
  return { assignmentId: data as string };
}
