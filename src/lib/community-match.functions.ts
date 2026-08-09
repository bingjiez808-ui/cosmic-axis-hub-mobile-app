/**
 * Community anonymous match pool — server functions.
 *
 * Privacy invariants (enforced here and by RLS):
 * - Client-facing responses expose ONLY: alias, ageBand?, facets, overall,
 *   overallBand, evidence bullets, inviteId, status, timestamps, mode.
 * - Never surface user_id, chart_id, email, birth data, geo, real name.
 * - Match results readable only when both grants are live.
 * - Compatibility scores are deterministic (compatibility-score-v1);
 *   no LLM calls in this file.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeCompatibility,
  canonicalPairKey,
  COMPATIBILITY_SCORE_VERSION,
  type CompatResult,
} from "@/lib/compatibility-score";
import { adaptFacetsFromFacts } from "@/lib/compatibility-facts-adapter";
import { buildCalculationSnapshot } from "@/lib/calc-snapshot";
import { buildPremiumFacts } from "@/lib/premium-facts";

export const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const MATCH_MODES = ["friendship", "romantic", "family", "work"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];
export const INVITE_STATUSES = ["pending", "accepted", "declined", "expired", "revoked", "blocked"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const COMMUNITY_MATCH_CONSENT_VERSION = "community-match-consent-v1";

/* ------------------------- pure helpers (exported for tests) ---------- */

/** Whitelist of keys allowed in any client-facing candidate/invite/result payload. */
export const CLIENT_SAFE_KEYS = new Set([
  "alias",
  "ageBand",
  "isPaused",
  "facets",
  "overall",
  "overallBand",
  "evidence",
  "resonances",
  "complements",
  "frictions",
  "suggestions",
  "inviteId",
  "status",
  "mode",
  "expiresAt",
  "createdAt",
  "respondedAt",
  "pairKey",
  "calculatorVersion",
  "partial",
  "confidence",
  "direction", // sent | received
]);

const PII_FORBIDDEN_KEY_PATTERNS = [
  /user_?id/i,
  /chart_?id/i,
  /email/i,
  /birth/i,
  /^dob$/i,
  /latitude|longitude|\blat\b|\blon\b/i,
  /place/i,
  /(?:^|_)name(?:_|$)/i,
  /real_?name/i,
];

/** Recursively assert an object contains no PII-shaped keys. Used in tests. */
export function assertNoPii(payload: unknown, path = "$"): void {
  if (payload == null || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    payload.forEach((v, i) => assertNoPii(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    for (const rx of PII_FORBIDDEN_KEY_PATTERNS) {
      if (rx.test(k)) throw new Error(`PII key leaked at ${path}.${k}`);
    }
    assertNoPii(v, `${path}.${k}`);
  }
}

/** Age-band from ISO date; null if under 18 or invalid. */
export function ageBandFromDob(dob: string | null | undefined): AgeBand | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const birth = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const md = now.getUTCMonth() - birth.getUTCMonth();
  if (md < 0 || (md === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  if (age < 18) return null;
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  return "55+";
}

/* ------------------------------ types --------------------------------- */

export type CommunityMatchProfile = {
  alias: string;
  ageBand: AgeBand | null;
  showAgeBand: boolean;
  isActive: boolean;
  isPaused: boolean;
  consentVersion: string;
  consentedAt: string;
};

export type CandidateCard = {
  alias: string;
  ageBand: AgeBand | null;
  facets: Array<{ key: string; score: number; band: string }>;
  overall: number;
  overallBand: string;
  evidence: string[];
  partial: boolean;
  confidence: number;
};

export type InviteView = {
  inviteId: string;
  direction: "sent" | "received";
  counterpartAlias: string;
  counterpartAgeBand: AgeBand | null;
  status: InviteStatus;
  mode: MatchMode;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
};

export type MatchView = {
  pairKey: string;
  mode: MatchMode;
  counterpartAlias: string;
  counterpartAgeBand: AgeBand | null;
  calculatorVersion: string;
  facets: Array<{ key: string; score: number; band: string }>;
  overall: number;
  overallBand: string;
  resonances: string[];
  complements: string[];
  frictions: string[];
  suggestions: string[];
  evidence: string[];
  createdAt: string;
  myGrantLive: boolean;
  theirGrantLive: boolean;
};

/* -------------------------- server functions -------------------------- */

const optInSchema = z.object({
  ageBand: z.enum(AGE_BANDS).nullable().optional(),
  showAgeBand: z.boolean().default(true),
});

export const optIntoCommunityMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => optInSchema.parse(d))
  .handler(async ({ data, context }): Promise<CommunityMatchProfile> => {
    const { data: row, error } = await context.supabase.rpc("community_match_opt_in" as never, {
      _age_band: data.ageBand ?? null,
      _show_age_band: data.showAgeBand,
      _consent_version: COMMUNITY_MATCH_CONSENT_VERSION,
    } as never);
    if (error || !row) throw new Error(error?.message ?? "opt_in_failed");
    const r = (Array.isArray(row) ? row[0] : row) as {
      anonymous_alias: string;
      age_band: AgeBand | null;
      show_age_band: boolean;
      is_active: boolean;
      paused_at: string | null;
      consent_version: string;
      consented_at: string;
    };
    return {
      alias: r.anonymous_alias,
      ageBand: r.age_band,
      showAgeBand: r.show_age_band,
      isActive: r.is_active,
      isPaused: r.paused_at != null,
      consentVersion: r.consent_version,
      consentedAt: r.consented_at,
    };
  });

export const getMyCommunityMatchProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommunityMatchProfile | null> => {
    const { data, error } = await context.supabase
      .from("community_match_profiles" as never)
      .select("anonymous_alias, age_band, show_age_band, is_active, paused_at, consent_version, consented_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const r = data as {
      anonymous_alias: string;
      age_band: AgeBand | null;
      show_age_band: boolean;
      is_active: boolean;
      paused_at: string | null;
      consent_version: string;
      consented_at: string;
    };
    return {
      alias: r.anonymous_alias,
      ageBand: r.age_band,
      showAgeBand: r.show_age_band,
      isActive: r.is_active,
      isPaused: r.paused_at != null,
      consentVersion: r.consent_version,
      consentedAt: r.consented_at,
    };
  });

export const setCommunityMatchPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("community_match_set_paused" as never, {
      _paused: data.paused,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const optOutOfCommunityMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("community_match_opt_out" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Load facets for a user_id via admin client. Cached per-process by chart_id. */
const facetsCache = new Map<string, ReturnType<typeof adaptFacetsFromFacts>>();
async function loadUserFacets(
  userId: string,
): Promise<{ chartId: string; facets: ReturnType<typeof adaptFacetsFromFacts> } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("charts")
    .select("id, birth_date, birth_time, birth_place, lang, input_snapshot")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("chart_role", "self")
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; birth_date: string | null; birth_time: string | null; birth_place: string | null; lang: string | null; input_snapshot: unknown };
  const cached = facetsCache.get(row.id);
  if (cached) return { chartId: row.id, facets: cached };
  const snapshot = (row.input_snapshot ?? {}) as { gender?: string };
  const gender = snapshot.gender === "male" || snapshot.gender === "female" ? snapshot.gender : undefined;
  const snap = buildCalculationSnapshot({
    date: row.birth_date ?? "",
    time: row.birth_time,
    place: row.birth_place,
    lang: (row.lang as "en" | "zh") ?? "en",
    gender,
  });
  const facts = buildPremiumFacts(snap);
  const adapted = adaptFacetsFromFacts(facts);
  facetsCache.set(row.id, adapted);
  return { chartId: row.id, facets: adapted };
}

function overallBandFor(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 45) return "mid";
  return "low";
}


function compatFromAdapted(
  meUserId: string,
  themUserId: string,
  meAdapted: ReturnType<typeof adaptFacetsFromFacts>,
  themAdapted: ReturnType<typeof adaptFacetsFromFacts>,
  mode: MatchMode,
  lang: "zh" | "en",
): CompatResult {
  const pluck = (a: ReturnType<typeof adaptFacetsFromFacts>) => ({
    yang: a.yang?.value,
    pace: a.pace?.value,
    openness: a.openness?.value,
    rootedness: a.rootedness?.value,
  });
  return computeCompatibility({
    a: { userId: meUserId, chartId: `me-${meUserId}`, facets: pluck(meAdapted) },
    b: { userId: themUserId, chartId: `them-${themUserId}`, facets: pluck(themAdapted) },
    mode,
    lang,
  });
}

function summarizeCandidate(compat: CompatResult): CandidateCard["facets"] & { overall: number; overallBand: string; evidence: string[]; partial: boolean; confidence: number } {
  const facets = compat.dimensions.map((d) => ({ key: d.key, score: d.score, band: d.band }));
  const evidence = [...compat.resonances, ...compat.complements].slice(0, 3);
  return Object.assign(facets, {
    overall: compat.overall,
    overallBand: overallBandFor(compat.overall),
    evidence,
    partial: !!compat.partial,
    confidence: compat.confidence,
  });
}

export const listCommunityMatchCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(20).default(10), mode: z.enum(MATCH_MODES).default("friendship"), lang: z.enum(["zh", "en"]).default("en") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<CandidateCard[]> => {
    const me = await loadUserFacets(context.userId);
    if (!me) throw new Error("primary_chart_required");
    const { data: rows, error } = await context.supabase.rpc("community_match_recommend" as never, {
      _limit: data.limit,
    } as never);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ invite_target_id: string; alias: string; age_band: AgeBand | null; is_paused: boolean }>;
    const out: CandidateCard[] = [];
    for (const cand of list) {
      const them = await loadUserFacets(cand.invite_target_id).catch(() => null);
      if (!them) continue;
      const compat = compatFromAdapted(context.userId, cand.invite_target_id, me.facets, them.facets, data.mode, data.lang);
      const s = summarizeCandidate(compat);
      out.push({
        alias: cand.alias,
        ageBand: cand.age_band,
        facets: s.slice(0, 5).map((f) => ({ key: f.key, score: f.score, band: f.band })),
        overall: s.overall,
        overallBand: s.overallBand,
        evidence: s.evidence,
        partial: s.partial,
        confidence: s.confidence,
      });
    }
    return out;
  });

/* invites */

export const sendCommunityMatchInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ alias: z.string().min(1).max(60), mode: z.enum(MATCH_MODES).default("friendship") }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ inviteId: string }> => {
    const { data: row, error } = await context.supabase.rpc("community_match_invite_by_alias" as never, {
      _alias: data.alias,
      _mode: data.mode,
    } as never);
    if (error || !row) throw new Error(error?.message ?? "invite_failed");
    const r = (Array.isArray(row) ? row[0] : row) as { id: string };
    return { inviteId: r.id };
  });

export const respondCommunityMatchInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ inviteId: z.string().uuid(), action: z.enum(["accept", "decline", "block"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ status: InviteStatus }> => {
    const { data: row, error } = await context.supabase.rpc("community_match_respond" as never, {
      _invite_id: data.inviteId,
      _action: data.action,
    } as never);
    if (error || !row) throw new Error(error?.message ?? "respond_failed");
    const r = (Array.isArray(row) ? row[0] : row) as { status: InviteStatus };
    if (data.action === "accept") {
      // Await: serverless workers may terminate before a detached promise
      // settles, which used to leave accepted pairs without a result row.
      await computeAndPersistPairSnapshot(
        context.supabase,
        context.userId,
        r as unknown as { sender_id: string; recipient_id: string; mode: MatchMode },
      ).catch(() => {});
    }
    return { status: r.status };
  });


export const revokeCommunityMatchInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("community_match_revoke_invite" as never, {
      _invite_id: data.inviteId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyCommunityMatchInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: InviteView[]; received: InviteView[] }> => {
    try { await context.supabase.rpc("community_match_expire_stale" as never); } catch { /* ignore */ }
    const { data, error } = await context.supabase
      .from("community_match_invites" as never)
      .select("id, sender_id, recipient_id, status, mode, expires_at, responded_at, created_at")
      .or(`sender_id.eq.${context.userId},recipient_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; sender_id: string; recipient_id: string; status: InviteStatus; mode: MatchMode; expires_at: string; responded_at: string | null; created_at: string }>;
    const otherIds = Array.from(new Set(rows.map((r) => (r.sender_id === context.userId ? r.recipient_id : r.sender_id))));
    const aliasMap = new Map<string, { alias: string; age_band: AgeBand | null; show: boolean }>();
    if (otherIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("community_match_profiles")
        .select("user_id, anonymous_alias, age_band, show_age_band")
        .in("user_id", otherIds);
      for (const p of (profs ?? []) as Array<{ user_id: string; anonymous_alias: string; age_band: AgeBand | null; show_age_band: boolean }>) {
        aliasMap.set(p.user_id, { alias: p.anonymous_alias, age_band: p.age_band, show: p.show_age_band });
      }
    }
    const toView = (r: (typeof rows)[number]): InviteView => {
      const otherId = r.sender_id === context.userId ? r.recipient_id : r.sender_id;
      const p = aliasMap.get(otherId);
      return {
        inviteId: r.id,
        direction: r.sender_id === context.userId ? "sent" : "received",
        counterpartAlias: p?.alias ?? "unknown",
        counterpartAgeBand: p?.show ? p.age_band : null,
        status: r.status,
        mode: r.mode,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        respondedAt: r.responded_at,
      };
    };
    return {
      sent: rows.filter((r) => r.sender_id === context.userId).map(toView),
      received: rows.filter((r) => r.recipient_id === context.userId).map(toView),
    };
  });

/* results */

type UserScopedSupabase = { rpc: (fn: never, args: never) => Promise<{ error: { message: string } | null }> };

/**
 * Compute the deterministic pair snapshot and persist it through the
 * grant-checked RPC (idempotent on pair_key+mode+calculator_version).
 * Returns the computed result so read paths can backfill inline.
 */
async function computeAndPersistPairSnapshot(
  supabase: unknown,
  meId: string,
  invite: { sender_id: string; recipient_id: string; mode: MatchMode },
): Promise<CompatResult | null> {
  const otherId = invite.sender_id === meId ? invite.recipient_id : invite.sender_id;
  const [me, them] = await Promise.all([loadUserFacets(meId), loadUserFacets(otherId)]);
  if (!me || !them) return null;
  const compat = compatFromAdapted(meId, otherId, me.facets, them.facets, invite.mode, "en");
  const pairKey = canonicalPairKey(meId, otherId).replace("::", ":");
  await (supabase as UserScopedSupabase).rpc("community_match_upsert_result" as never, {
    _pair_key: pairKey,
    _mode: invite.mode,
    _calc_version: COMPATIBILITY_SCORE_VERSION,
    _facets: compat.dimensions,
    _score: { overall: compat.overall, overallBand: overallBandFor(compat.overall) },
    _evidence: {
      resonances: compat.resonances,
      complements: compat.complements,
      frictions: compat.frictions,
      suggestions: compat.suggestions,
      evidence: compat.evidence_refs,
    },
  } as never);
  return compat;
}


export const listMyCommunityMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MatchView[]> => {
    const { data: grantRows, error: gErr } = await context.supabase
      .from("community_match_grants" as never)
      .select("pair_key, a_user_id, b_user_id, mode, a_granted_at, b_granted_at, a_revoked_at, b_revoked_at")
      .or(`a_user_id.eq.${context.userId},b_user_id.eq.${context.userId}`);
    if (gErr) throw new Error(gErr.message);
    const grants = (grantRows ?? []) as Array<{ pair_key: string; a_user_id: string; b_user_id: string; mode: MatchMode; a_granted_at: string | null; b_granted_at: string | null; a_revoked_at: string | null; b_revoked_at: string | null }>;
    if (grants.length === 0) return [];
    const { data: resRows } = await context.supabase
      .from("community_match_results" as never)
      .select("pair_key, mode, calculator_version, facets_snapshot, score_snapshot, evidence_summary, created_at")
      .in("pair_key", grants.map((g) => g.pair_key));
    const results = new Map<string, unknown>();
    for (const r of ((resRows ?? []) as Array<{ pair_key: string; mode: MatchMode } & Record<string, unknown>>)) {
      results.set(`${r.pair_key}:${r.mode}`, r);
    }
    const otherIds = grants.map((g) => (g.a_user_id === context.userId ? g.b_user_id : g.a_user_id));
    const aliasMap = new Map<string, { alias: string; age_band: AgeBand | null; show: boolean }>();
    if (otherIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("community_match_profiles")
        .select("user_id, anonymous_alias, age_band, show_age_band")
        .in("user_id", otherIds);
      for (const p of (profs ?? []) as Array<{ user_id: string; anonymous_alias: string; age_band: AgeBand | null; show_age_band: boolean }>) {
        aliasMap.set(p.user_id, { alias: p.anonymous_alias, age_band: p.age_band, show: p.show_age_band });
      }
    }
    // Backfill: a pair whose grants are both live but has no snapshot (e.g.
    // an accept that failed to persist) is computed on read, once.
    const computed = new Map<string, CompatResult>();
    for (const g of grants) {
      const key = `${g.pair_key}:${g.mode}`;
      const bothLive = g.a_granted_at && g.b_granted_at && !g.a_revoked_at && !g.b_revoked_at;
      if (results.has(key) || !bothLive) continue;
      const otherId = g.a_user_id === context.userId ? g.b_user_id : g.a_user_id;
      const compat = await computeAndPersistPairSnapshot(context.supabase, context.userId, {
        sender_id: context.userId,
        recipient_id: otherId,
        mode: g.mode,
      }).catch(() => null);
      if (compat) computed.set(key, compat);
    }
    const views: MatchView[] = [];
    for (const g of grants) {
      const otherId = g.a_user_id === context.userId ? g.b_user_id : g.a_user_id;
      const meGrantLive = (g.a_user_id === context.userId ? g.a_granted_at && !g.a_revoked_at : g.b_granted_at && !g.b_revoked_at);
      const themGrantLive = (g.a_user_id === context.userId ? g.b_granted_at && !g.b_revoked_at : g.a_granted_at && !g.a_revoked_at);
      const p = aliasMap.get(otherId);
      const fresh = computed.get(`${g.pair_key}:${g.mode}`);
      const r = (results.get(`${g.pair_key}:${g.mode}`) ??
        (fresh
          ? {
              facets_snapshot: fresh.dimensions,
              score_snapshot: { overall: fresh.overall, overallBand: overallBandFor(fresh.overall) },
              evidence_summary: {
                resonances: fresh.resonances,
                complements: fresh.complements,
                frictions: fresh.frictions,
                suggestions: fresh.suggestions,
                evidence: fresh.evidence_refs,
              },
              calculator_version: COMPATIBILITY_SCORE_VERSION,
              created_at: new Date().toISOString(),
            }
          : undefined)) as
        | { facets_snapshot: Array<{ key: string; score: number; band: string }>; score_snapshot: { overall: number; overallBand: string }; evidence_summary: { resonances: string[]; complements: string[]; frictions: string[]; suggestions: string[]; evidence: string[] }; calculator_version: string; created_at: string }
        | undefined;

      views.push({
        pairKey: g.pair_key,
        mode: g.mode,
        counterpartAlias: p?.alias ?? "unknown",
        counterpartAgeBand: p?.show ? p.age_band : null,
        calculatorVersion: r?.calculator_version ?? COMPATIBILITY_SCORE_VERSION,
        facets: r?.facets_snapshot ?? [],
        overall: r?.score_snapshot?.overall ?? 0,
        overallBand: r?.score_snapshot?.overallBand ?? "mid",
        resonances: r?.evidence_summary?.resonances ?? [],
        complements: r?.evidence_summary?.complements ?? [],
        frictions: r?.evidence_summary?.frictions ?? [],
        suggestions: r?.evidence_summary?.suggestions ?? [],
        evidence: r?.evidence_summary?.evidence ?? [],
        createdAt: r?.created_at ?? new Date().toISOString(),
        myGrantLive: Boolean(meGrantLive),
        theirGrantLive: Boolean(themGrantLive),
      });
    }
    return views;
  });

export const revokeCommunityMatchGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pairKey: z.string(), mode: z.enum(MATCH_MODES).default("friendship") }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("community_match_revoke_grant" as never, {
      _pair_key: data.pairKey,
      _mode: data.mode,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportCommunityMatchAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ alias: z.string().min(1).max(60), category: z.string().min(1).max(60), detail: z.string().max(600).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("community_match_profiles")
      .select("user_id")
      .eq("anonymous_alias", data.alias)
      .maybeSingle();
    if (!prof) throw new Error("alias_not_found");
    const reportedId = (prof as { user_id: string }).user_id;
    const { error } = await context.supabase.from("friend_reports").insert({
      reporter_id: context.userId,
      reported_id: reportedId,
      category: data.category,
      detail: data.detail ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
