/**
 * 同门 · 众生之厅 — admin moderation (server-only).
 *
 * Every call goes through a SECURITY DEFINER RPC that re-checks the caller's
 * admin role inside Postgres and writes a `community_moderation_events` audit
 * row. No service-role client is used, so a non-admin session can never reach
 * these paths even if the UI is bypassed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export type AdminLetter = {
  id: string;
  authorId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  targetAgeBand: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  deliveredCount: number;
  replyCount: number;
  reportCount: number;
};

export type AdminReply = {
  id: string;
  letterId: string;
  authorId: string;
  body: string;
  status: string;
  createdAt: string;
  reportCount: number;
};

export type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminParticipant = {
  userId: string;
  alias: string | null;
  ageBand: string | null;
  optIn: boolean;
  status: string;
  updatedAt: string;
};

export type AdminDelivery = {
  id: string;
  letterId: string;
  recipientId: string;
  status: string;
  deliveredAt: string;
  readAt: string | null;
  repliedAt: string | null;
};

export type AdminEvent = {
  id: string;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  action: string;
  notes: string | null;
  createdAt: string;
};

export type AdminHallOverview = {
  letters: AdminLetter[];
  replies: AdminReply[];
  reports: AdminReport[];
  participants: AdminParticipant[];
  deliveries: AdminDelivery[];
  events: AdminEvent[];
};

function fail(error: { message?: string } | null): never {
  const raw = error?.message ?? "";
  if (raw.includes("not_allowed")) throw new Error("没有权限执行该操作。");
  if (raw.includes("not_found")) throw new Error("目标内容不存在。");
  throw new Error("操作失败，请稍后再试。");
}

export async function loadAdminHallOverview(ctx: Ctx): Promise<AdminHallOverview> {
  const { data, error } = await ctx.supabase.rpc("admin_community_hall_overview");
  if (error) fail(error);
  const box = (data ?? {}) as Partial<AdminHallOverview>;
  return {
    letters: box.letters ?? [],
    replies: box.replies ?? [],
    reports: box.reports ?? [],
    participants: box.participants ?? [],
    deliveries: box.deliveries ?? [],
    events: box.events ?? [],
  };
}

export async function moderateLetter(
  ctx: Ctx,
  input: { letterId: string; action: string; notes?: string | null },
) {
  const { data, error } = await ctx.supabase.rpc("admin_moderate_community_letter", {
    _letter_id: input.letterId,
    _action: input.action,
    _notes: input.notes ?? "",
  });
  if (error) fail(error);
  return (data ?? {}) as { action: string; delivered: number };
}

export async function moderateReply(
  ctx: Ctx,
  input: { replyId: string; action: string; notes?: string | null },
) {
  const { data, error } = await ctx.supabase.rpc("admin_moderate_community_reply", {
    _reply_id: input.replyId,
    _action: input.action,
    _notes: input.notes ?? "",
  });
  if (error) fail(error);
  return (data ?? {}) as { action: string };
}

export async function setParticipation(
  ctx: Ctx,
  input: { userId: string; status: string; notes?: string | null },
) {
  const { data, error } = await ctx.supabase.rpc("admin_set_community_participation", {
    _user_id: input.userId,
    _status: input.status,
    _notes: input.notes ?? "",
  });
  if (error) fail(error);
  return (data ?? {}) as { status: string };
}

export type HallMetrics = {
  days: number;
  since: string;
  letters: Record<string, number>;
  deliveries: Record<string, number>;
  replies: Record<string, number>;
  reports: Record<string, number>;
  participants: Record<string, number>;
  moderation: Array<{ action: string; count: number }>;
  ageBands: Array<{ band: string; count: number }>;
  medianFirstEchoHours: number | null;
};

export async function loadHallMetrics(ctx: Ctx, days: number): Promise<HallMetrics> {
  const { data, error } = await ctx.supabase.rpc("admin_community_hall_metrics", { _days: days });
  if (error) fail(error);
  return data as unknown as HallMetrics;
}

export type AuditRow = {
  id: string;
  actor_id: string | null;
  target_type: string;
  target_id: string | null;
  action: string;
  notes: string | null;
  created_at: string;
};

export async function loadAuditLog(
  ctx: Ctx,
  input: { targetType?: string | null; action?: string | null; limit?: number },
): Promise<AuditRow[]> {
  const { data, error } = await ctx.supabase.rpc("admin_community_audit_log", {
    _target_type: input.targetType ?? undefined,
    _action: input.action ?? undefined,
    _limit: input.limit ?? 200,
  });
  if (error) fail(error);
  return (data ?? []) as unknown as AuditRow[];
}
