/**
 * 历代先贤 · Council of Sages — server function boundary.
 *
 * Thin wrappers only: validation + delegation. All logic lives in
 * `sage-council.server.ts` so route splitting never strips a runtime sibling.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AGE_BANDS } from "./community-hall-safety";
import {
  askSage,
  assignLetter,
  claimSageCredits,
  readSageCreditHistory,
  readDeskLetters,
  readLibrarianDesk,
  readMyAssignments,
  readSageEntitlement,
  requestHumanReply,
  respondToAssignment,
  sendLibrarianLetter,
} from "./sage-council.server";

const bandEnum = z.enum(AGE_BANDS);
const letterIdSchema = z.object({ letterId: z.string().uuid() });

const askSchema = z.object({
  personaId: z.string().trim().min(1).max(60),
  subject: z.string().trim().max(80).optional().nullable(),
  body: z.string().trim().min(30).max(1200),
  topic: z.string().trim().max(40).optional().nullable(),
  targetAgeBand: bandEnum,
  lang: z.enum(["zh", "en"]).default("zh"),
});

const librarianSchema = z.object({
  subject: z.string().trim().max(80).optional().nullable(),
  body: z.string().trim().min(30).max(1200),
  topic: z.string().trim().max(40).optional().nullable(),
  targetAgeBand: bandEnum,
  responseStyle: z.string().trim().max(40).optional().nullable(),
});

/** Tier + the three monthly human-reply grants. */
export const getSageEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readSageEntitlement(context));

/** Claim this month's three human-reply grants. */
export const claimHumanReplyGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => claimSageCredits(context));

/** Claim + spend ledger for the human-reply grants. */
export const getHumanReplyGrantHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readSageCreditHistory(context));

/** Sage member: write to a distilled historical persona and receive the answer. */
export const askSagePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => askSchema.parse(data))
  .handler(async ({ data, context }) => askSage(context, data));

/** Any member: place a letter on the librarian's desk. */
export const sendLetterToLibrarian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => librarianSchema.parse(data))
  .handler(async ({ data, context }) => sendLibrarianLetter(context, data));

/** My own sage / librarian correspondence with its replies. */
export const getMyDeskLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ route: z.enum(["sage", "librarian"]).default("sage") }).parse(data ?? {}))
  .handler(async ({ data, context }) => readDeskLetters(context, data.route));

/** Letters the librarian handed to me. */
export const getMyLetterAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readMyAssignments(context));

export const respondToLetterAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assignmentId: z.string().uuid(), accept: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => respondToAssignment(context, data.assignmentId, data.accept));

/** Spend one human-reply grant: escalate a sage letter to a real person. */
export const requestHumanReplyForLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => letterIdSchema.parse(data))
  .handler(async ({ data, context }) => requestHumanReply(context, data.letterId));

/** Admin only. */
export const getLibrarianDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readLibrarianDesk(context));

/** Admin only: hand a letter to an opted-in traveler. */
export const assignLetterToTraveler = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        letterId: z.string().uuid(),
        assigneeId: z.string().uuid(),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => assignLetter(context, data));
