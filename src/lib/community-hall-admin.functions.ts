/**
 * 同门 · 众生之厅 — admin moderation server functions.
 * Auth is enforced twice: bearer middleware here, admin role inside each RPC.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadAdminHallOverview,
  moderateLetter,
  moderateReply,
  setParticipation,
  type AdminHallOverview,
} from "./community-hall-admin.server";

export type {
  AdminHallOverview,
  AdminLetter,
  AdminReply,
  AdminReport,
  AdminParticipant,
  AdminDelivery,
  AdminEvent,
} from "./community-hall-admin.server";

const letterActionSchema = z.object({
  letterId: z.string().uuid(),
  action: z.enum(["approve", "hide", "reject", "redact", "redispatch"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const replyActionSchema = z.object({
  replyId: z.string().uuid(),
  action: z.enum(["approve", "hide", "reject", "redact"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const participationSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "paused", "banned"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const getCommunityHallAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminHallOverview> => loadAdminHallOverview(context));

export const moderateCommunityLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterActionSchema.parse(data))
  .handler(async ({ data, context }) => moderateLetter(context, data));

export const moderateCommunityReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => replyActionSchema.parse(data))
  .handler(async ({ data, context }) => moderateReply(context, data));

export const setCommunityParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => participationSchema.parse(data))
  .handler(async ({ data, context }) => setParticipation(context, data));
