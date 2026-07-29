/**
 * Redemption code server functions.
 *
 * Security model:
 *   - Pepper (REDEMPTION_CODE_PEPPER) never touches the DB. All HMAC
 *     computation happens here; the DB only receives `code_hash`.
 *   - Every write goes through a SECURITY DEFINER RPC that re-verifies
 *     admin role (`private.has_role`).
 *   - Rate limits blunt scripted enumeration; failures are ALWAYS
 *     reported with the generic `code_invalid` string so an attacker
 *     cannot distinguish "not found" from "wrong pepper".
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "./rate-limit.server";
import {
  codeMeta,
  mintRandomCode,
  normalizeCode,
  type RedemptionBenefitType,
} from "./redemption-format";

function getPepper(): string {
  const v = process.env.REDEMPTION_CODE_PEPPER;
  if (!v || v.length < 16) throw new Error("redemption_pepper_not_configured");
  return v;
}

function hashCode(normalized: string): string {
  return createHmac("sha256", getPepper()).update(normalized).digest("hex");
}

function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return createHmac("sha256", getPepper()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

function seededRng(): () => number {
  // node:crypto random bytes → deterministic-ish generator per code
  const buf = randomBytes(48);
  let i = 0;
  return () => {
    const b = buf[i++ % buf.length];
    return b / 256;
  };
}

// ============================================================
// Admin: create codes (batch)
// ============================================================

const CreateInput = z.object({
  benefitType: z.enum([
    "sage_membership",
    "oracle_membership",
    "premium_report",
    "test_access",
    "support_compensation",
  ]),
  quantity: z.number().int().min(1).max(500),
  durationDays: z.number().int().min(1).max(3650).nullable(),
  maxRedemptions: z.number().int().min(1).max(100000).default(1),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reportScope: z.enum(["current_chart", "next_selected_chart"]).nullable().optional(),
  campaignName: z.string().trim().max(80).nullable().optional(),
  internalNote: z.string().trim().max(500).nullable().optional(),
  assignedEmail: z.string().trim().email().max(254).nullable().optional(),
});

export type CreatedCode = { id: string; code: string; codePrefix: string; codeLast4: string };

export const adminCreateRedemptionCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }): Promise<{ codes: CreatedCode[] }> => {
    enforceRateLimit(`admin_code_create:${context.userId}`, 20, 60_000, "code batches");
    const supabase = context.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const rng = seededRng();
    const results: CreatedCode[] = [];
    for (let i = 0; i < data.quantity; i += 1) {
      // Up to 5 retries on the rare hash collision.
      let attempt = 0;
      let inserted = false;
      while (attempt < 5 && !inserted) {
        attempt += 1;
        const plaintext = mintRandomCode(data.benefitType, rng);
        const normalized = normalizeCode(plaintext);
        if (!normalized) throw new Error("mint_produced_invalid_code");
        const meta = codeMeta(plaintext);
        if (!meta) throw new Error("mint_meta_invalid");
        const codeHash = hashCode(normalized);
        const { data: newId, error } = await supabase.rpc("admin_create_redemption_code", {
          _code_hash: codeHash,
          _code_prefix: meta.prefix,
          _code_last4: meta.last4,
          _benefit_type: data.benefitType,
          _duration_days: data.durationDays,
          _max_redemptions: data.maxRedemptions,
          _starts_at: data.startsAt ?? null,
          _expires_at: data.expiresAt ?? null,
          _report_scope: data.reportScope ?? null,
          _campaign_name: data.campaignName ?? null,
          _internal_note: data.internalNote ?? null,
          _assigned_email: data.assignedEmail ?? null,
        });
        if (error) {
          if (/redemption_codes_code_hash_key/i.test(error.message)) continue;
          throw new Error(error.message);
        }
        results.push({ id: String(newId), code: plaintext, codePrefix: meta.prefix, codeLast4: meta.last4 });
        inserted = true;
      }
      if (!inserted) throw new Error("code_generation_failed");
    }
    return { codes: results };
  });

// ============================================================
// Admin: list codes / uses / disable
// ============================================================

const ListCodesInput = z.object({
  benefitType: z
    .enum(["sage_membership", "oracle_membership", "premium_report", "test_access", "support_compensation"])
    .nullable()
    .optional(),
  status: z.enum(["active", "disabled", "exhausted", "expired"]).nullable().optional(),
  campaignName: z.string().trim().max(80).nullable().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export type AdminCodeRow = {
  id: string;
  code_prefix: string;
  code_last4: string;
  benefit_type: RedemptionBenefitType;
  duration_days: number | null;
  report_scope: string | null;
  max_redemptions: number;
  redemption_count: number;
  starts_at: string | null;
  expires_at: string | null;
  status: string;
  campaign_name: string | null;
  internal_note: string | null;
  created_by: string;
  created_at: string;
  assigned_email: string | null;
};

export const adminListRedemptionCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListCodesInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<AdminCodeRow[]> => {
    const supabase = context.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: rows, error } = await supabase.rpc("admin_list_redemption_codes", {
      _benefit_type: data.benefitType ?? null,
      _status: data.status ?? null,
      _campaign_name: data.campaignName ?? null,
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);
    return (rows as AdminCodeRow[]) ?? [];
  });

const DisableInput = z.object({ codeId: z.string().uuid() });
export const adminDisableRedemptionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DisableInput.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await supabase.rpc("admin_disable_redemption_code", { _code_id: data.codeId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const ListUsesInput = z.object({
  codeId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});
export type AdminUseRow = {
  id: string;
  redemption_code_id: string;
  code_prefix: string;
  code_last4: string;
  benefit_type: RedemptionBenefitType;
  user_id: string;
  user_email: string | null;
  chart_id: string | null;
  order_id: string | null;
  status: string;
  entitlement_id: string | null;
  failure_code: string | null;
  redeemed_at: string;
  fulfilled_at: string | null;
};
export const adminListRedemptionUses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListUsesInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<AdminUseRow[]> => {
    const supabase = context.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: rows, error } = await supabase.rpc("admin_list_redemption_uses", {
      _code_id: data.codeId ?? null,
      _user_id: data.userId ?? null,
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);
    return (rows as AdminUseRow[]) ?? [];
  });

// ============================================================
// User: redeem
// ============================================================

const RedeemInput = z.object({
  code: z.string().trim().min(6).max(60),
  chartId: z.string().uuid().nullable().optional(),
  requestId: z.string().min(8).max(80),
});

export type RedeemResult =
  | {
      status: "fulfilled";
      benefitType: RedemptionBenefitType;
      idempotent: boolean;
      chartId: string | null;
      entitlementId: string | null;
      codePrefix: string;
      codeLast4: string;
      membership: {
        tier: "none" | "sage" | "oracle";
        expiresAt: string | null;
        startedAt: string | null;
      } | null;
      report: { orderId: string; chartId: string } | null;
    };

const KNOWN_ERROR_CODES = new Set([
  "code_invalid",
  "code_not_yet_active",
  "code_expired",
  "code_exhausted",
  "already_redeemed_by_user",
  "chart_required",
  "chart_not_owned",
  "report_already_owned",
  "not_authenticated",
  "invalid_request_id",
  "rate_limited",
  "code_not_assigned_to_you",
]);

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RedeemInput.parse(data))
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    // Per-user + per-IP rate limits.
    enforceRateLimit(`redeem:user:${context.userId}:min`, 5, 60_000, "redemption attempts");
    enforceRateLimit(`redeem:user:${context.userId}:hr`, 15, 3_600_000, "redemption attempts");

    const normalized = normalizeCode(data.code);
    if (!normalized) throw new Error("code_invalid");
    const meta = codeMeta(data.code)!;
    const codeHash = hashCode(normalized);

    // IP-hash rate limit (best-effort — worker sees x-forwarded-for).
    let ipHash: string | null = null;
    try {
      const headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
      const rawIp = getRequestIP({ xForwardedFor: true }) ?? headers["cf-connecting-ip"] ?? null;
      ipHash = hashIp(rawIp ?? null);
      if (ipHash) enforceRateLimit(`redeem:ip:${ipHash}:hr`, 60, 3_600_000, "redemption attempts");
    } catch {
      // Header helpers unavailable → skip IP throttle.
    }

    const uaSummary = (() => {
      try {
        const headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
        const ua = String(headers["user-agent"] ?? "").slice(0, 120);
        return ua || null;
      } catch {
        return null;
      }
    })();

    const supabase = context.supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
    };
    const { data: raw, error } = await supabase.rpc("redeem_code", {
      _code_hash: codeHash,
      _code_prefix: meta.prefix,
      _chart_id: data.chartId ?? null,
      _request_id: data.requestId,
      _ip_hash: ipHash,
      _user_agent_summary: uaSummary,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      for (const known of KNOWN_ERROR_CODES) {
        if (msg.includes(known)) throw new Error(known);
      }
      throw new Error("fulfillment_failed");
    }
    const result = raw as {
      idempotent: boolean;
      status: string;
      benefit_type: RedemptionBenefitType;
      entitlement_id: string | null;
      chart_id: string | null;
      membership: { tier: "none" | "sage" | "oracle"; expires_at: string | null; started_at: string | null } | null;
      report: { order_id: string; chart_id: string } | null;
      code_prefix?: string;
      code_last4?: string;
    };
    return {
      status: "fulfilled",
      benefitType: result.benefit_type,
      idempotent: result.idempotent,
      chartId: result.chart_id,
      entitlementId: result.entitlement_id,
      codePrefix: result.code_prefix ?? meta.prefix,
      codeLast4: result.code_last4 ?? "",
      membership: result.membership
        ? {
            tier: result.membership.tier,
            expiresAt: result.membership.expires_at,
            startedAt: result.membership.started_at,
          }
        : null,
      report: result.report ? { orderId: result.report.order_id, chartId: result.report.chart_id } : null,
    };
  });

// ============================================================
// User: list own redemption uses
// ============================================================

export type MyRedemptionUse = {
  id: string;
  benefit_type: RedemptionBenefitType;
  code_prefix: string;
  code_last4: string;
  chart_id: string | null;
  order_id: string | null;
  status: string;
  redeemed_at: string;
  fulfilled_at: string | null;
  duration_days: number | null;
  campaign_name: string | null;
};

export const listMyRedemptionUses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRedemptionUse[]> => {
    const supabase = context.supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await supabase.rpc("list_my_redemption_uses", {});
    if (error) throw new Error(error.message);
    return (data as MyRedemptionUse[]) ?? [];
  });
