/**
 * 同门 · 众生之厅 — server functions (round 1, backend only).
 *
 * Every write goes through a SECURITY DEFINER RPC that re-verifies auth,
 * 18+ status, recipient membership and rate limits inside Postgres. These
 * wrappers add transport-level validation, in-memory burst throttling and
 * content-safety screening. Letter bodies are never logged.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AGE_BANDS } from "./community-hall-safety";
import {
  blockLetterAuthor,
  dispatchLetter,
  loadMailbox,
  markNotificationsRead,
  readCommunityProfile,
  listLibrarySamples,
  markOnboarded,
  readDispatchState,
  requestNextWave,
  reportContent,
  saveCommunityProfile,
  sendLetter,
  setDeliveryState,
  setEchoSaved,
  closeLetter,
  submitReply,
  toggleBlock,
  type CommunityMailbox,
} from "./community-hall.server";

const bandEnum = z.enum(AGE_BANDS);

const profileSchema = z.object({
  alias: z.string().trim().min(1).max(40).optional().nullable(),
  academy: z.string().trim().max(40).optional().nullable(),
  element: z.string().trim().max(24).optional().nullable(),
  avatarUrl: z.string().trim().max(400).optional().nullable(),
  quote: z.string().trim().max(140).optional().nullable(),
  language: z.enum(["zh", "en"]).default("zh"),
  optIn: z.boolean().default(false),
  paused: z.boolean().default(false),
});

const sendSchema = z.object({
  subject: z.string().trim().max(80).optional().nullable(),
  body: z.string().trim().min(30).max(1200),
  topic: z.string().trim().max(40).optional().nullable(),
  targetAgeBand: bandEnum,
  responseStyle: z.string().trim().max(40).optional().nullable(),
});

const replySchema = z.object({
  letterId: z.string().uuid(),
  body: z.string().trim().min(20).max(800),
});

const reportSchema = z.object({
  targetType: z.enum(["letter", "reply", "profile"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(1).max(60),
  details: z.string().trim().max(1000).optional().nullable(),
});

const blockSchema = z.object({ userId: z.string().uuid(), blocked: z.boolean() });
const letterIdSchema = z.object({ letterId: z.string().uuid() });

export type { CommunityMailbox };

export const getMyCommunityProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readCommunityProfile(context));

export const upsertMyCommunityProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => profileSchema.parse(data))
  .handler(async ({ data, context }) => saveCommunityProfile(context, data));

export const sendCommunityLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendSchema.parse(data))
  .handler(async ({ data, context }) => sendLetter(context, data));

export const dispatchCommunityLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => dispatchLetter(context, data.letterId));

export const replyToCommunityLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => replySchema.parse(data))
  .handler(async ({ data, context }) => submitReply(context, data));

export const getMyCommunityMailbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadMailbox(context));

export const reportCommunityContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => reportSchema.parse(data))
  .handler(async ({ data, context }) => reportContent(context, data));

export const setCommunityBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => blockSchema.parse(data))
  .handler(async ({ data, context }) => toggleBlock(context, data));

const deliverySchema = z.object({
  letterId: z.string().uuid(),
  state: z.enum(["read", "archived", "restore"]),
});

export const setCommunityDeliveryState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deliverySchema.parse(data))
  .handler(async ({ data, context }) => setDeliveryState(context, data));

export const markCommunityNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(data))
  .handler(async ({ data, context }) => markNotificationsRead(context, data.ids));

export const blockCommunityLetterAuthor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => blockLetterAuthor(context, data.letterId));

export const setCommunityEchoSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ replyId: z.string().uuid(), saved: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => setEchoSaved(context, data));

export const closeCommunityLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => closeLetter(context, data.letterId));

/** Author-only: delivery telemetry for one letter (waves, reads, replies). */
export const getCommunityLetterDispatchState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => readDispatchState(context, data.letterId));

/** Author-only: release the next delivery wave once the wave window has passed. */
export const requestCommunityLetterWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => requestNextWave(context, data.letterId));

/** Cold-start reading material: curated library samples, clearly labelled. */
export const getCommunityLibrarySamples = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ language: z.enum(["zh", "en"]).nullish(), limit: z.number().int().min(1).max(50).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => listLibrarySamples(context, data));

/** Mark the three onboarding cards as seen. */
export const markCommunityOnboarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => markOnboarded(context));
