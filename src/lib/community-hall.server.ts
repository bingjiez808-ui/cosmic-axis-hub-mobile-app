/**
 * 同门 · 众生之厅 — server-only implementation.
 *
 * All DB access uses the caller's authenticated Supabase client (RLS applies)
 * plus SECURITY DEFINER RPCs for privileged writes. No service-role usage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { enforceRateLimit } from "./rate-limit.server";
import { safetyMessage, screenCommunityText, type AgeBand } from "./community-hall-safety";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export type CommunityIdentity = {
  alias: string | null;
  academy: string | null;
  element: string | null;
  avatarUrl: string | null;
  quote: string | null;
  ageBand: AgeBand | null;
};

export type MailboxIdentity = {
  alias: string | null;
  academy: string | null;
  element: string | null;
  avatarUrl: string | null;
  quote: string | null;
  ageBand: string | null;
};

export type ReceivedLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  responseStyle: string | null;
  targetAgeBand: string;
  createdAt: string;
  expiresAt: string;
  deliveredAt: string;
  readAt: string | null;
  repliedAt: string | null;
  status: string;
  author: MailboxIdentity;
};

export type SentLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  targetAgeBand: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  deliveredCount: number;
  replyCount: number;
};

export type EchoReply = {
  replyId: string;
  letterId: string;
  body: string;
  createdAt: string;
  author: MailboxIdentity;
};

export type MyReply = {
  replyId: string;
  letterId: string;
  body: string;
  status: string;
  createdAt: string;
};

export type CommunityNotification = {
  id: string;
  type: string;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CommunityMailbox = {
  ageBand: AgeBand | null;
  received: ReceivedLetter[];
  sent: SentLetter[];
  echoes: EchoReply[];
  myReplies: MyReply[];
  notifications: CommunityNotification[];
};

const RPC_ERRORS: Record<string, string> = {
  auth_required: "请先登录。",
  adult_verification_required: "众生之厅目前仅向已满 18 周岁的旅者开放，请先在账户中补全出生日期。",
  invalid_target_age_band: "请选择一个有效的年龄区间。",
  invalid_body_length: "正文长度不符合要求。",
  daily_letter_limit: "今天已经寄出 3 封信了，明天再来吧。",
  hourly_reply_limit: "这一小时的回信次数已达上限，请稍后再试。",
  hourly_report_limit: "举报过于频繁，请稍后再试。",
  duplicate_submission: "刚刚已经提交过相同内容了。",
  not_a_recipient: "只有收到这封信的人才能回信。",
  letter_not_found: "这封信不存在或你无权访问。",
  letter_expired: "这封信已经过期。",
  not_allowed: "没有权限执行该操作。",
};

function friendly(error: { message?: string } | null): never {
  const raw = error?.message ?? "unknown_error";
  const key = Object.keys(RPC_ERRORS).find((k) => raw.includes(k));
  throw new Error(key ? RPC_ERRORS[key] : "操作失败，请稍后再试。");
}

export async function readCommunityProfile(ctx: Ctx) {
  const { data: band } = await ctx.supabase.rpc("community_age_band", { _uid: ctx.userId });
  const { data } = await ctx.supabase
    .from("community_profiles")
    .select("alias, academy, element, avatar_url, quote, age_band, language, opt_in, status")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return {
    eligible: Boolean(band),
    ageBand: (band as AgeBand | null) ?? null,
    profile: data
      ? {
          alias: data.alias,
          academy: data.academy,
          element: data.element,
          avatarUrl: data.avatar_url,
          quote: data.quote,
          ageBand: data.age_band as AgeBand | null,
          language: data.language,
          optIn: data.opt_in,
          status: data.status,
        }
      : null,
  };
}

export async function saveCommunityProfile(
  ctx: Ctx,
  input: {
    alias?: string | null;
    academy?: string | null;
    element?: string | null;
    avatarUrl?: string | null;
    quote?: string | null;
    language: "zh" | "en";
    optIn: boolean;
    paused: boolean;
  },
) {
  enforceRateLimit(`community-hall:profile:${ctx.userId}`, 20, 60_000, "profile updates");
  for (const value of [input.alias, input.quote, input.academy]) {
    if (!value) continue;
    const verdict = screenCommunityText(value);
    if (verdict.action === "block") throw new Error(safetyMessage(verdict.categories));
  }
  const { error } = await ctx.supabase.from("community_profiles").upsert(
    {
      user_id: ctx.userId,
      alias: input.alias ?? null,
      academy: input.academy ?? null,
      element: input.element ?? null,
      avatar_url: input.avatarUrl ?? null,
      quote: input.quote ?? null,
      language: input.language,
      opt_in: input.optIn,
      status: input.paused ? "paused" : "active",
    },
    { onConflict: "user_id" },
  );
  if (error) friendly(error);
  return readCommunityProfile(ctx);
}

export async function sendLetter(
  ctx: Ctx,
  input: {
    subject?: string | null;
    body: string;
    topic?: string | null;
    targetAgeBand: AgeBand;
    responseStyle?: string | null;
  },
) {
  enforceRateLimit(`community-hall:send:${ctx.userId}`, 3, 24 * 60 * 60_000, "letters");
  const verdict = screenCommunityText(`${input.subject ?? ""}\n${input.body}`);
  if (verdict.action === "block") throw new Error(safetyMessage(verdict.categories));

  const { data: letterId, error } = await ctx.supabase.rpc("send_community_letter", {
    _subject: input.subject ?? "",
    _body: input.body,
    _topic: input.topic ?? "",
    _target_age_band: input.targetAgeBand,
    _response_style: input.responseStyle ?? "",
    _needs_review: verdict.action === "review",
  });
  if (error || !letterId) friendly(error);

  let delivered = 0;
  if (verdict.action !== "review") {
    const { data } = await ctx.supabase.rpc("dispatch_community_letter", { _letter_id: letterId });
    delivered = Number(data ?? 0);
  }
  return { letterId: letterId as string, pendingReview: verdict.action === "review", delivered };
}

export async function dispatchLetter(ctx: Ctx, letterId: string) {
  enforceRateLimit(`community-hall:dispatch:${ctx.userId}`, 12, 60 * 60_000, "dispatches");
  const { data, error } = await ctx.supabase.rpc("dispatch_community_letter", { _letter_id: letterId });
  if (error) friendly(error);
  return { delivered: Number(data ?? 0) };
}

export async function submitReply(ctx: Ctx, input: { letterId: string; body: string }) {
  enforceRateLimit(`community-hall:reply:${ctx.userId}`, 10, 60 * 60_000, "replies");
  const verdict = screenCommunityText(input.body);
  if (verdict.action === "block") throw new Error(safetyMessage(verdict.categories));
  const { data, error } = await ctx.supabase.rpc("reply_to_community_letter", {
    _letter_id: input.letterId,
    _body: input.body,
    _needs_review: verdict.action === "review",
  });
  if (error || !data) friendly(error);
  return { replyId: data as string, pendingReview: verdict.action === "review" };
}

export async function loadMailbox(ctx: Ctx): Promise<CommunityMailbox> {
  const { data, error } = await ctx.supabase.rpc("get_my_community_mailbox");
  if (error) friendly(error);
  const box = (data ?? {}) as Partial<CommunityMailbox>;
  return {
    ageBand: (box.ageBand as AgeBand | null) ?? null,
    received: box.received ?? [],
    sent: box.sent ?? [],
    echoes: box.echoes ?? [],
    myReplies: box.myReplies ?? [],
    notifications: box.notifications ?? [],
  };
}

export async function reportContent(
  ctx: Ctx,
  input: { targetType: "letter" | "reply" | "profile"; targetId: string; reason: string; details?: string | null },
) {
  enforceRateLimit(`community-hall:report:${ctx.userId}`, 10, 60 * 60_000, "reports");
  const { data, error } = await ctx.supabase.rpc("report_community_content", {
    _target_type: input.targetType,
    _target_id: input.targetId,
    _reason: input.reason,
    _details: input.details ?? "",
  });
  if (error) friendly(error);
  return { reportId: data as string };
}

export async function toggleBlock(ctx: Ctx, input: { userId: string; blocked: boolean }) {
  enforceRateLimit(`community-hall:block:${ctx.userId}`, 30, 60 * 60_000, "block updates");
  if (input.userId === ctx.userId) throw new Error("不能拉黑自己。");
  if (input.blocked) {
    const { error } = await ctx.supabase
      .from("community_blocks")
      .upsert({ blocker_id: ctx.userId, blocked_user_id: input.userId }, { onConflict: "blocker_id,blocked_user_id" });
    if (error) friendly(error);
  } else {
    const { error } = await ctx.supabase
      .from("community_blocks")
      .delete()
      .eq("blocker_id", ctx.userId)
      .eq("blocked_user_id", input.userId);
    if (error) friendly(error);
  }
  return { blocked: input.blocked };
}
