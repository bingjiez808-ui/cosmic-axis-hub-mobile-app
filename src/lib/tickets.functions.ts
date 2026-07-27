import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "./rate-limit.server";

/**
 * Feedback / support ticket surface.
 *
 * Design invariants:
 *  - `sageChat` NEVER writes a ticket. It returns a draft (category,
 *    subject, message summary) and the UI shows a "登记到后台" button.
 *    The user must call `createFeedbackTicket` to actually persist.
 *  - `createFeedbackTicket` is authenticated; user_id is derived from
 *    the bearer token, never trusted from the client.
 *  - Same `(user_id, requestId)` returns the pre-existing ticket rather
 *    than creating a duplicate.
 *  - `listMyTickets` never selects `admin_note` — a defense in depth on
 *    top of the column-level GRANT set in the migration.
 *  - `adminListTickets` / `adminUpdateTicket` verify `has_role(admin)`
 *    server-side via the RLS-scoped context client BEFORE loading the
 *    service-role admin client.
 */

export const TICKET_CATEGORIES = [
  "product",
  "device",
  "order",
  "payment",
  "subscription",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = [
  "new",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

const CreateInput = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(2000),
  orderId: z.string().uuid().optional().nullable(),
  requestId: z.string().min(6).max(80),
  lang: z.enum(["en", "zh"]).default("zh"),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

const PUBLIC_COLUMNS =
  "id, ticket_code, category, subject, status, priority, order_id, message, user_reply, lang, created_at, updated_at, resolved_at";

const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, admin_note, user_id, request_id, keywords`;

export type MyTicket = {
  id: string;
  ticket_code: string;
  category: TicketCategory;
  subject: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  order_id: string | null;
  message: string;
  user_reply: string | null;
  lang: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type AdminTicket = MyTicket & {
  admin_note: string | null;
  user_id: string | null;
  request_id: string | null;
  keywords: string[];
  user_email?: string | null;
};

/**
 * User-initiated: persist a feedback draft the user just confirmed.
 * Idempotent per (user, requestId).
 */
export const createFeedbackTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }): Promise<MyTicket> => {
    const { supabase, userId } = context;
    enforceRateLimit(`ticket-create:${userId}`, 10, 60_000, "ticket submissions");

    // Idempotency short-circuit: existing ticket wins.
    const existing = await supabase
      .from("user_feedback")
      .select(PUBLIC_COLUMNS)
      .eq("user_id", userId)
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (existing.data) return existing.data as MyTicket;

    // Confirm the caller actually owns the order (if provided) before linking.
    let linkedOrderId: string | null = null;
    if (data.orderId) {
      const own = await supabase
        .from("premium_report_orders")
        .select("id")
        .eq("id", data.orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (own.data) linkedOrderId = own.data.id;
    }

    const insert = await supabase
      .from("user_feedback")
      .insert({
        user_id: userId,
        category: data.category,
        subject: data.subject,
        message: data.message,
        order_id: linkedOrderId,
        request_id: data.requestId,
        lang: data.lang,
        priority: data.priority ?? "normal",
        keywords: [],
      })
      .select(PUBLIC_COLUMNS)
      .single();

    if (insert.error) {
      // Race: unique (user_id, request_id) violation → re-fetch.
      if (insert.error.code === "23505") {
        const retry = await supabase
          .from("user_feedback")
          .select(PUBLIC_COLUMNS)
          .eq("user_id", userId)
          .eq("request_id", data.requestId)
          .maybeSingle();
        if (retry.data) return retry.data as MyTicket;
      }
      throw new Error(insert.error.message);
    }
    return insert.data as MyTicket;
  });

/**
 * User-facing: my own tickets. Never returns admin_note.
 */
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTicket[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_feedback")
      .select(PUBLIC_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as MyTicket[];
  });

// ---- Admin surface ---------------------------------------------------

const AdminListInput = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

async function assertAdmin(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify admin role");
  if (!data) throw new Error("FORBIDDEN: admin role required");
}

export const adminListTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AdminListInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<AdminTicket[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("user_feedback")
      .select(ADMIN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) query = query.eq("status", data.status);
    if (data.category) query = query.eq("category", data.category);
    if (data.q) {
      const like = `%${data.q.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(
        `ticket_code.ilike.${like},subject.ilike.${like},message.ilike.${like}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as AdminTicket[];

    // Hydrate user emails so admin can identify the reporter.
    const userIds = Array.from(
      new Set(list.map((r) => r.user_id).filter((v): v is string => !!v)),
    );
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p.email as string | null]));
      for (const t of list) t.user_email = t.user_id ? (map.get(t.user_id) ?? null) : null;
    }
    return list;
  });

const AdminUpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  admin_note: z.string().trim().max(4000).optional().nullable(),
});

export const adminUpdateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AdminUpdateInput.parse(data))
  .handler(async ({ data, context }): Promise<AdminTicket> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const patch: {
      status?: TicketStatus;
      priority?: TicketPriority;
      admin_note?: string | null;
    } = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
    if (Object.keys(patch).length === 0) {
      throw new Error("Nothing to update");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("user_feedback")
      .update(patch)
      .eq("id", data.id)
      .select(ADMIN_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return updated as AdminTicket;
  });
