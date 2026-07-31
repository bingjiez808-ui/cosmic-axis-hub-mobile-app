/**
 * 同门 · 众生之厅 — server-only implementation.
 *
 * All DB access uses the caller's authenticated Supabase client (RLS applies)
 * plus SECURITY DEFINER RPCs for privileged writes. No service-role usage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { enforceRateLimit } from "./rate-limit.server";
import {
  needsSupportResources,
  riskLevel,
  safetyCode,
  screenCommunityText,
  type AgeBand,
} from "./community-hall-safety";
import { hallError, type HallErrorCode } from "./community-hall-errors";

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
  savedAt?: string | null;
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

const RPC_CODES: Array<[string, HallErrorCode]> = [
  ["auth_required", "auth_required"],
  ["adult_verification_required", "adult_required"],
  ["invalid_target_age_band", "invalid_age_band"],
  ["invalid_body_length", "invalid_body_length"],
  ["daily_letter_limit", "daily_letter_limit"],
  ["hourly_reply_limit", "hourly_reply_limit"],
  ["hourly_report_limit", "hourly_report_limit"],
  ["duplicate_submission", "duplicate_submission"],
  ["already_replied", "already_replied"],
  ["not_a_recipient", "not_a_recipient"],
  ["letter_not_found", "letter_not_found"],
  ["letter_expired", "letter_expired"],
  ["letter_closed", "letter_closed"],
  ["not_allowed", "not_allowed"],
];

/** Translate any DB/transport failure into a stable client-facing code. */
function friendly(error: { message?: string } | null): never {
  const raw = error?.message ?? "unknown_error";
  const hit = RPC_CODES.find(([needle]) => raw.includes(needle));
  throw hallError(hit ? hit[1] : "unknown");
}

/** Rate limiting, expressed in the same code vocabulary. */
function limit(key: string, max: number, windowMs: number, code: HallErrorCode) {
  try {
    enforceRateLimit(key, max, windowMs, key);
  } catch {
    throw hallError(code);
  }
}

export async function readCommunityProfile(ctx: Ctx) {
  const { data: band } = await ctx.supabase.rpc("community_age_band", { _uid: ctx.userId });
  const { data } = await ctx.supabase
    .from("community_profiles")
    .select(
      "alias, academy, element, avatar_url, quote, age_band, language, opt_in, status, onboarded_at, accepts_assignments",
    )
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
          onboardedAt: (data as { onboarded_at?: string | null }).onboarded_at ?? null,
          acceptsAssignments: Boolean(
            (data as { accepts_assignments?: boolean }).accepts_assignments,
          ),
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
  limit(`community-hall:profile:${ctx.userId}`, 20, 60_000, "rate_limited");
  for (const value of [input.alias, input.quote, input.academy]) {
    if (!value) continue;
    const verdict = screenCommunityText(value);
    if (verdict.action === "block") throw hallError(safetyCode(verdict.categories));
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
    /** 'delivered_only' = courier picks the readers; 'wall' = public board. */
    visibility?: "delivered_only" | "wall";
  },
) {
  limit(`community-hall:send:${ctx.userId}`, 3, 24 * 60 * 60_000, "daily_letter_limit");
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
    _visibility: input.visibility ?? "delivered_only",
  });
  if (error || !letterId) friendly(error);

  const onWall = (input.visibility ?? "delivered_only") === "wall";
  let delivered = 0;
  if (!held && !onWall) {
    const { data } = await ctx.supabase.rpc("dispatch_community_letter", { _letter_id: letterId });
    delivered = Number(data ?? 0);
  }
  return {
    letterId: letterId as string,
    pendingReview: held,
    visibility: onWall ? ("wall" as const) : ("delivered_only" as const),
    delivered,
    riskLevel: risk,
    showSupport: needsSupportResources(verdict),
  };
}

export async function dispatchLetter(ctx: Ctx, letterId: string) {
  limit(`community-hall:dispatch:${ctx.userId}`, 12, 60 * 60_000, "rate_limited");
  const { data, error } = await ctx.supabase.rpc("dispatch_community_letter", { _letter_id: letterId });
  if (error) friendly(error);
  return { delivered: Number(data ?? 0) };
}

export type LetterDispatchState = {
  letterId: string;
  status: string;
  wave: number;
  deliveredCount: number;
  readCount: number;
  replyCount: number;
  maxRecipients: number;
  maxReplies: number;
  lastDispatchAt: string | null;
  nextWaveAt: string | null;
  expiresAt: string | null;
  canRequestWave: boolean;
  waiting: boolean;
  waitingHintHours: number;
};

/** Author-facing delivery telemetry: how many waves went out, who read, who replied. */
export async function readDispatchState(ctx: Ctx, letterId: string): Promise<LetterDispatchState> {
  const { data, error } = await ctx.supabase.rpc("get_community_letter_dispatch_state", {
    _letter_id: letterId,
  });
  if (error || !data) friendly(error);
  return data as unknown as LetterDispatchState;
}

/**
 * Author-facing "send the next wave" action. The wave window, recipient cap and
 * per-reader daily quota are all enforced inside `dispatch_community_letter`;
 * this only adds a burst throttle and returns the refreshed state.
 */
export async function requestNextWave(ctx: Ctx, letterId: string) {
  limit(`community-hall:wave:${ctx.userId}`, 6, 60 * 60_000, "rate_limited");
  const { data, error } = await ctx.supabase.rpc("dispatch_community_letter", { _letter_id: letterId });
  if (error) friendly(error);
  const delivered = Number(data ?? 0);
  return { delivered, state: await readDispatchState(ctx, letterId) };
}


export async function submitReply(ctx: Ctx, input: { letterId: string; body: string }) {
  limit(`community-hall:reply:${ctx.userId}`, 10, 60 * 60_000, "hourly_reply_limit");
  const verdict = screenCommunityText(input.body);
  if (verdict.action === "block") throw hallError(safetyCode(verdict.categories));
  const risk = riskLevel(verdict);
  const { data, error } = await ctx.supabase.rpc("reply_to_community_letter", {
    _letter_id: input.letterId,
    _body: input.body,
    _needs_review: risk !== "none",
  });
  if (error || !data) friendly(error);
  return {
    replyId: data as string,
    pendingReview: risk !== "none",
    showSupport: needsSupportResources(verdict),
  };
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
  limit(`community-hall:report:${ctx.userId}`, 10, 60 * 60_000, "hourly_report_limit");
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
  limit(`community-hall:block:${ctx.userId}`, 30, 60 * 60_000, "rate_limited");
  if (input.userId === ctx.userId) throw hallError("not_allowed");
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

/** Recipient-side delivery state. Only `read` / `archived` are client-settable
 *  (enforced again by the `community_deliveries_guard` trigger in Postgres). */
export async function setDeliveryState(
  ctx: Ctx,
  input: { letterId: string; state: "read" | "archived" | "restore" },
) {
  limit(`community-hall:delivery:${ctx.userId}`, 120, 60 * 60_000, "rate_limited");
  const { data: current, error: readError } = await ctx.supabase
    .from("community_letter_deliveries")
    .select("id, status, read_at, replied_at")
    .eq("letter_id", input.letterId)
    .eq("recipient_id", ctx.userId)
    .maybeSingle();
  if (readError) friendly(readError);
  if (!current) throw hallError("letter_not_found");

  const patch: { status?: string; read_at?: string } = {};
  if (input.state === "read") {
    if (current.read_at) return { status: current.status };
    patch.read_at = new Date().toISOString();
    if (current.status === "delivered") patch.status = "read";
  } else if (input.state === "archived") {
    patch.status = "archived";
  } else {
    patch.status = current.replied_at ? "replied" : current.read_at ? "read" : "delivered";
  }

  const { data, error } = await ctx.supabase
    .from("community_letter_deliveries")
    .update(patch)
    .eq("id", current.id)
    .select("status")
    .maybeSingle();
  if (error) friendly(error);
  return { status: data?.status ?? current.status };
}

export async function markNotificationsRead(ctx: Ctx, ids: string[]) {
  if (ids.length === 0) return { updated: 0 };
  const { error, count } = await ctx.supabase
    .from("community_notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", ctx.userId)
    .in("id", ids.slice(0, 50))
    .is("read_at", null);
  if (error) friendly(error);
  return { updated: count ?? 0 };
}

/**
 * Block the (anonymous) author of a letter this user actually received.
 * The author's user id is resolved server-side and never returned, so the
 * recipient can block without ever learning who wrote the letter.
 */
export async function blockLetterAuthor(ctx: Ctx, letterId: string) {
  const { data: delivery, error } = await ctx.supabase
    .from("community_letter_deliveries")
    .select("id")
    .eq("letter_id", letterId)
    .eq("recipient_id", ctx.userId)
    .maybeSingle();
  if (error) friendly(error);
  if (!delivery) throw hallError("letter_not_found");

  const { data: letter } = await ctx.supabase
    .from("community_letters")
    .select("author_id")
    .eq("id", letterId)
    .maybeSingle();
  if (!letter?.author_id) throw hallError("letter_not_found");

  await toggleBlock(ctx, { userId: letter.author_id, blocked: true });
  return { blocked: true };
}

/** Author-only: keep an echo on the personal shelf (private, never public). */
export async function setEchoSaved(ctx: Ctx, input: { replyId: string; saved: boolean }) {
  limit(`community-hall:save-echo:${ctx.userId}`, 60, 60 * 60_000, "rate_limited");
  const { error } = await ctx.supabase.rpc("set_community_echo_saved", {
    _reply_id: input.replyId,
    _saved: input.saved,
  });
  if (error) friendly(error);
  return { saved: input.saved };
}

/** Author-only: stop collecting further echoes for one letter. */
export async function closeLetter(ctx: Ctx, letterId: string) {
  limit(`community-hall:close-letter:${ctx.userId}`, 30, 60 * 60_000, "rate_limited");
  const { data, error } = await ctx.supabase.rpc("close_community_letter", { _letter_id: letterId });
  if (error) friendly(error);
  return { status: (data as string | null) ?? "closed" };
}

export type LibrarySample = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  targetAgeBand: string;
  responseStyle: string | null;
  language: string;
  publishedAt: string | null;
  echoes: Array<{ id: string; body: string; ageBand: string }>;
};

/**
 * Cold-start reading material. These are curated library samples written for
 * the hall itself: they carry no author, are never delivered to anyone and
 * cannot be replied to — the UI must label them as 馆藏范文 / Library sample.
 */
export async function listLibrarySamples(
  ctx: Ctx,
  input: { language?: "zh" | "en" | null; limit?: number },
): Promise<LibrarySample[]> {
  const { data, error } = await ctx.supabase.rpc("get_community_library_samples", {
    _language: input.language ?? undefined,
    _limit: input.limit ?? 12,
  });
  if (error) friendly(error);
  return (data ?? []) as unknown as LibrarySample[];
}

/** Record that this traveler has seen the three onboarding cards. */
export async function markOnboarded(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("mark_community_onboarded");
  if (error) friendly(error);
  return { onboardedAt: (data as string | null) ?? null };
}

/**
 * Privacy: erase everything this member wrote or received in the hall.
 * Runs inside a SECURITY DEFINER RPC so the deletion is atomic and audited
 * (the audit row records the action only, never any content).
 */
export async function deleteMyCommunityData(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("delete_my_community_data");
  if (error) friendly(error);
  return (data ?? {}) as {
    letters: number;
    replies: number;
    deliveries: number;
    reports: number;
    notifications: number;
    profile: number;
  };
}


export type PublicWallAuthor = MailboxIdentity;

export type PublicWallLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  responseStyle: string | null;
  targetAgeBand: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  mine: boolean;
  echoCount: number;
  iReplied: boolean;
  author: PublicWallAuthor;
};

export type PublicWallLetterDetail = Omit<PublicWallLetter, "echoCount"> & {
  echoes: Array<{
    replyId: string;
    body: string;
    createdAt: string;
    mine: boolean;
    author: PublicWallAuthor;
  }>;
};

/** The open board: letters their authors chose to post publicly. */
export async function readPublicWall(ctx: Ctx, limit = 30): Promise<PublicWallLetter[]> {
  const { data, error } = await ctx.supabase.rpc("get_community_public_wall", { _limit: limit });
  if (error) friendly(error);
  return (data ?? []) as unknown as PublicWallLetter[];
}

/** One public letter with every approved echo beneath it. */
export async function readPublicLetter(ctx: Ctx, letterId: string): Promise<PublicWallLetterDetail> {
  const { data, error } = await ctx.supabase.rpc("get_community_public_letter", {
    _letter_id: letterId,
  });
  if (error || !data) friendly(error);
  return data as unknown as PublicWallLetterDetail;
}
