/**
 * Friends — real Supabase-backed server functions.
 *
 * Replaces the in-memory demo repo used by `/me/friends`.
 * No free-form chat: only invites (one-time codes), friendships,
 * blocks, reports and template-based structured notes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "./rate-limit.server";

export type FriendSummary = {
  friendshipId: string;
  userId: string;
  alias: string;
  createdAt: number;
  unreadNotes: number;
};

export type InviteSummary = {
  id: string;
  code: string;
  direction: "incoming" | "outgoing";
  status: string;
  message: string | null;
  counterpartAlias: string | null;
  expiresAt: number;
  createdAt: number;
};

export type BlockSummary = { id: string; userId: string; alias: string; createdAt: number };

export type NoteSummary = {
  id: string;
  direction: "incoming" | "outgoing";
  counterpartAlias: string;
  templateId: string;
  body: string;
  createdAt: number;
  readAt: number | null;
};

export type NotificationSummary = {
  id: string;
  type: string;
  createdAt: number;
  readAt: number | null;
  payload: { alias?: string; preview?: string };
};

export type FriendsSnapshot = {
  friends: FriendSummary[];
  invites: InviteSummary[];
  blocks: BlockSummary[];
  notes: NoteSummary[];
  notifications: NotificationSummary[];
};

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

function fallbackAlias(userId: string) {
  return `馆友 · ${userId.slice(0, 6)}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

async function aliasMap(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  for (const id of unique) map.set(id, fallbackAlias(id));
  if (unique.length === 0) return map;
  const sb = await admin();
  const { data } = await sb.from("community_profiles").select("user_id, alias").in("user_id", unique);
  for (const row of (data ?? []) as Array<{ user_id: string; alias: string | null }>) {
    if (row.alias) map.set(row.user_id, row.alias);
  }
  return map;
}

async function notify(
  userId: string,
  type: string,
  entityId: string | null,
  payload: { alias?: string; preview?: string },
) {
  const sb = await admin();
  await sb.from("community_notifications").insert({
    user_id: userId,
    type,
    entity_id: entityId,
    payload,
  });
}

async function areBlocked(a: string, b: string) {
  const sb = await admin();
  const { data } = await sb
    .from("friend_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

function makeCode() {
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "inv_";
  for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)]!;
  return s;
}

/* ── snapshot ─────────────────────────────────────────────── */

export const getFriendsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendsSnapshot> => {
    const me = context.userId;
    const sb = await admin();

    const [friendshipsRes, invitesRes, blocksRes, notesRes, notifRes] = await Promise.all([
      sb
        .from("friendships")
        .select("id, a_user_id, b_user_id, created_at")
        .is("removed_at", null)
        .or(`a_user_id.eq.${me},b_user_id.eq.${me}`)
        .order("created_at", { ascending: false }),
      sb
        .from("friend_invites")
        .select("id, code, inviter_id, target_id, status, message, expires_at, created_at")
        .eq("status", "pending")
        .or(`inviter_id.eq.${me},target_id.eq.${me}`)
        .order("created_at", { ascending: false }),
      sb
        .from("friend_blocks")
        .select("id, blocked_id, created_at")
        .eq("blocker_id", me)
        .order("created_at", { ascending: false }),
      sb
        .from("friend_notes")
        .select("id, sender_id, recipient_id, template_id, body, read_at, created_at")
        .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
        .order("created_at", { ascending: false })
        .limit(60),
      sb
        .from("community_notifications")
        .select("id, type, payload, read_at, created_at")
        .eq("user_id", me)
        .like("type", "friend_%")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const friendships = (friendshipsRes.data ?? []) as Array<{
      id: string;
      a_user_id: string;
      b_user_id: string;
      created_at: string;
    }>;
    const invites = (invitesRes.data ?? []) as Array<{
      id: string;
      code: string;
      inviter_id: string;
      target_id: string | null;
      status: string;
      message: string | null;
      expires_at: string;
      created_at: string;
    }>;
    const blocks = (blocksRes.data ?? []) as Array<{
      id: string;
      blocked_id: string;
      created_at: string;
    }>;
    const notes = (notesRes.data ?? []) as Array<{
      id: string;
      sender_id: string;
      recipient_id: string;
      template_id: string;
      body: string;
      read_at: string | null;
      created_at: string;
    }>;
    const notifications = (notifRes.data ?? []) as Array<{
      id: string;
      type: string;
      payload: { alias?: string; preview?: string } | null;
      read_at: string | null;
      created_at: string;
    }>;

    const others = [
      ...friendships.map((f) => (f.a_user_id === me ? f.b_user_id : f.a_user_id)),
      ...invites.flatMap((i) => [i.inviter_id, i.target_id ?? ""]),
      ...blocks.map((b) => b.blocked_id),
      ...notes.flatMap((n) => [n.sender_id, n.recipient_id]),
    ];
    const aliases = await aliasMap(others);

    const unread = new Map<string, number>();
    for (const n of notes) {
      if (n.recipient_id === me && !n.read_at) {
        unread.set(n.sender_id, (unread.get(n.sender_id) ?? 0) + 1);
      }
    }

    return {
      friends: friendships.map((f) => {
        const other = f.a_user_id === me ? f.b_user_id : f.a_user_id;
        return {
          friendshipId: f.id,
          userId: other,
          alias: aliases.get(other) ?? fallbackAlias(other),
          createdAt: ms(f.created_at),
          unreadNotes: unread.get(other) ?? 0,
        };
      }),
      invites: invites
        .filter((i) => ms(i.expires_at) > Date.now())
        .map((i) => {
          const outgoing = i.inviter_id === me;
          const counterpart = outgoing ? i.target_id : i.inviter_id;
          return {
            id: i.id,
            code: i.code,
            direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
            status: i.status,
            message: i.message,
            counterpartAlias: counterpart ? (aliases.get(counterpart) ?? fallbackAlias(counterpart)) : null,
            expiresAt: ms(i.expires_at),
            createdAt: ms(i.created_at),
          };
        })
        // Codes with no target are open links: only the inviter sees them.
        .filter((i) => i.direction === "outgoing" || i.counterpartAlias !== null),
      blocks: blocks.map((b) => ({
        id: b.id,
        userId: b.blocked_id,
        alias: aliases.get(b.blocked_id) ?? fallbackAlias(b.blocked_id),
        createdAt: ms(b.created_at),
      })),
      notes: notes.map((n) => {
        const outgoing = n.sender_id === me;
        const other = outgoing ? n.recipient_id : n.sender_id;
        return {
          id: n.id,
          direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
          counterpartAlias: aliases.get(other) ?? fallbackAlias(other),
          templateId: n.template_id,
          body: n.body,
          createdAt: ms(n.created_at),
          readAt: n.read_at ? ms(n.read_at) : null,
        };
      }),
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        createdAt: ms(n.created_at),
        readAt: n.read_at ? ms(n.read_at) : null,
        payload: n.payload ?? {},
      })),
    };
  });

/* ── invites ──────────────────────────────────────────────── */

export const createFriendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message?: string }) =>
    z.object({ message: z.string().trim().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    enforceRateLimit(`friend-invite:${context.userId}`, 10, 60_000, "friend invites");
    const sb = await admin();
    const { data: row, error } = await sb
      .from("friend_invites")
      .insert({
        inviter_id: context.userId,
        code: makeCode(),
        message: data.message || null,
      })
      .select("code, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { code: (row as { code: string }).code, expiresAt: ms((row as { expires_at: string }).expires_at) };
  });

export const redeemFriendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    enforceRateLimit(`friend-redeem:${context.userId}`, 20, 60_000, "invite redemptions");
    const me = context.userId;
    const sb = await admin();
    const code = data.code.trim().toLowerCase();
    const { data: inv } = await sb
      .from("friend_invites")
      .select("id, inviter_id, target_id, status, expires_at")
      .eq("code", code)
      .maybeSingle();
    // Expected, user-correctable outcomes are returned, not thrown: throwing
    // across the server-fn boundary surfaces as an unhandled runtime error.
    if (!inv) return { ok: false as const, error: "invite_not_found" };
    const invite = inv as {
      id: string;
      inviter_id: string;
      target_id: string | null;
      status: string;
      expires_at: string;
    };
    if (invite.inviter_id === me) return { ok: false as const, error: "self_invite" };
    if (invite.status !== "pending") return { ok: false as const, error: "invite_not_pending" };
    if (ms(invite.expires_at) < Date.now()) {
      await sb.from("friend_invites").update({ status: "expired" }).eq("id", invite.id);
      return { ok: false as const, error: "invite_expired" };
    }
    if (invite.target_id && invite.target_id !== me) return { ok: false as const, error: "not_target" };
    if (await areBlocked(me, invite.inviter_id)) {
      return { ok: false as const, error: "blocked_relationship" };
    }

    // Attach the redeemer as the target: it becomes a pending incoming invite
    // the inviter can already see, and it is immediately accepted below.
    await sb
      .from("friend_invites")
      .update({ target_id: me, status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invite.id);

    const [a, b] = me < invite.inviter_id ? [me, invite.inviter_id] : [invite.inviter_id, me];
    const { data: existing } = await sb
      .from("friendships")
      .select("id")
      .eq("a_user_id", a)
      .eq("b_user_id", b)
      .is("removed_at", null)
      .maybeSingle();
    if (!existing) {
      const { error } = await sb
        .from("friendships")
        .insert({ a_user_id: a, b_user_id: b, invite_id: invite.id });
      if (error) throw new Error(error.message);
    }
    const aliases = await aliasMap([me]);
    await notify(invite.inviter_id, "friend_invite_accepted", invite.id, {
      alias: aliases.get(me) ?? fallbackAlias(me),
    });
    return { ok: true as const, error: null };
  });

export const respondFriendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string; action: "accept" | "reject" | "cancel" }) =>
    z
      .object({
        inviteId: z.string().uuid(),
        action: z.enum(["accept", "reject", "cancel"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const sb = await admin();
    const { data: inv } = await sb
      .from("friend_invites")
      .select("id, code, inviter_id, target_id, status, expires_at")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!inv) throw new Error("invite_not_found");
    const invite = inv as {
      id: string;
      code: string;
      inviter_id: string;
      target_id: string | null;
      status: string;
      expires_at: string;
    };
    if (invite.status !== "pending") throw new Error("invite_not_pending");

    if (data.action === "cancel") {
      if (invite.inviter_id !== me) throw new Error("not_inviter");
      await sb.from("friend_invites").update({ status: "cancelled" }).eq("id", invite.id);
      return { ok: true };
    }
    if (invite.target_id !== me) throw new Error("not_target");
    if (data.action === "reject") {
      await sb
        .from("friend_invites")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", invite.id);
      return { ok: true };
    }
    return redeemFriendInvite({ data: { code: invite.code } });
  });

/* ── friendships / blocks / reports ───────────────────────── */

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const sb = await admin();
    const [a, b] = me < data.userId ? [me, data.userId] : [data.userId, me];
    await sb
      .from("friendships")
      .update({ removed_at: new Date().toISOString() })
      .eq("a_user_id", a)
      .eq("b_user_id", b)
      .is("removed_at", null);
    return { ok: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason?: string }) =>
    z.object({ userId: z.string().uuid(), reason: z.string().trim().max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId;
    if (me === data.userId) throw new Error("self_block");
    const sb = await admin();
    await sb
      .from("friend_blocks")
      .upsert(
        { blocker_id: me, blocked_id: data.userId, reason: data.reason ?? null },
        { onConflict: "blocker_id,blocked_id" },
      );
    const [a, b] = me < data.userId ? [me, data.userId] : [data.userId, me];
    await sb
      .from("friendships")
      .update({ removed_at: new Date().toISOString() })
      .eq("a_user_id", a)
      .eq("b_user_id", b)
      .is("removed_at", null);
    await sb
      .from("friend_invites")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .or(
        `and(inviter_id.eq.${me},target_id.eq.${data.userId}),and(inviter_id.eq.${data.userId},target_id.eq.${me})`,
      );
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await sb
      .from("friend_blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_id", data.userId);
    return { ok: true };
  });

export const reportUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; category: string; detail?: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        category: z.string().trim().min(1).max(60),
        detail: z.string().trim().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    enforceRateLimit(`friend-report:${context.userId}`, 6, 60_000, "reports");
    const sb = await admin();
    const { error } = await sb.from("friend_reports").insert({
      reporter_id: context.userId,
      reported_id: data.userId,
      category: data.category,
      detail: data.detail ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ── structured notes ─────────────────────────────────────── */

export const sendFriendNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; templateId: string; body: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        templateId: z.string().trim().min(1).max(60),
        body: z.string().trim().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    enforceRateLimit(`friend-note:${context.userId}`, 20, 60_000, "notes");
    const me = context.userId;
    const sb = await admin();
    const [a, b] = me < data.userId ? [me, data.userId] : [data.userId, me];
    const { data: fr } = await sb
      .from("friendships")
      .select("id")
      .eq("a_user_id", a)
      .eq("b_user_id", b)
      .is("removed_at", null)
      .maybeSingle();
    if (!fr) throw new Error("not_friends");
    if (await areBlocked(me, data.userId)) throw new Error("blocked_relationship");
    const { error } = await sb.from("friend_notes").insert({
      sender_id: me,
      recipient_id: data.userId,
      template_id: data.templateId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    const aliases = await aliasMap([me]);
    await notify(data.userId, "friend_note_received", null, {
      alias: aliases.get(me) ?? fallbackAlias(me),
      preview: data.body.slice(0, 40),
    });
    return { ok: true };
  });

export const markFriendNotesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    const sb = await admin();
    await sb
      .from("friend_notes")
      .update({ read_at: now })
      .eq("recipient_id", context.userId)
      .is("read_at", null);
    await sb
      .from("community_notifications")
      .update({ read_at: now })
      .eq("user_id", context.userId)
      .like("type", "friend_%")
      .is("read_at", null);
    return { ok: true };
  });
