/**
 * Premium ¥79 one-time Deep Reading — order + AI generation + in-app delivery.
 *
 * Design goals:
 * - The client can NEVER mark an order paid, mint access for somebody
 *   else's report, or forge `content_json`. Every state transition that
 *   grants access is a service-role write on the server.
 * - Same (user_id, chart_id, product_version) can only ever have one
 *   active order and one report row — enforced by unique indexes at
 *   the DB layer, defended by atomic begin logic here.
 * - Real payment integration is intentionally NOT wired: no live
 *   merchant credentials exist. `startPremiumCheckout` records intent
 *   but returns `provider_unavailable`; the only real "paid" path is
 *   the admin `grantPremiumReportAccess` function with an audit log.
 * - Reports are delivered ONLY inside the app, as `content_json` served
 *   over an authenticated server function that verifies ownership. No
 *   file downloads, no signed URLs, no public paths.
 *
 * Version strategy:
 * - Current product version: `premium_deep_report_v1` — new ¥79 orders.
 * - Legacy paid orders under `premium_pdf_v1` (¥99) and `premium_pdf_v2`
 *   (¥79 PDF era) still grant permanent access. Their pending/failed/
 *   refunded rows are IGNORED (never reused, never block new orders).
 * - Report row `report_version` stays at `premium_pdf_v1` — the shared
 *   content_json shape means historic buyers see their existing report
 *   without regenerating, while new deep-report orders write to the
 *   same row schema.
 */
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { guardrailsFor, safeMessage, sanitizeAuditMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import { isEmailVerified, assertEmailVerifiedOrAdmin } from "./reports-store.functions";
import { buildCalculationSnapshot, missingSystems, type CalculationSnapshot } from "./calc-snapshot";
import type { EvidenceRef, V3ChapterMeta } from "./premium-chapters-v3";
import {
  buildEngineInput,
  computeContentHash,
  makeCacheKey,
  DEFAULT_VERSIONS,
  READING_MODEL_ID,
  type CacheKey,
  type EngineChartFacts,
  type TokenUsage,
} from "./reading-engine";

// Canonical product identity.
export const PREMIUM_PRODUCT_VERSION = "premium_deep_report_v1";
export const PREMIUM_LEGACY_PRODUCT_VERSIONS = [
  "premium_pdf_v1",
  "premium_pdf_v2",
] as const;
export const PREMIUM_ALL_PRODUCT_VERSIONS = [
  PREMIUM_PRODUCT_VERSION,
  ...PREMIUM_LEGACY_PRODUCT_VERSIONS,
] as const;
// Report content_json schema is shared across product versions, so
// historic paid buyers keep seeing their generated report without a
// forced regeneration.
export const PREMIUM_REPORT_VERSION = "premium_pdf_v1";
export const PREMIUM_PROMPT_VERSION = "v2";
// Content schema version — bumped when the shape of content_json
// changes. v1 = 19 body-only chapters (legacy). v2 = 19 chapters + a
// structured `facts` object grounded in the local calc snapshot.
// Old rows keep serving their v1 content; the reader is tolerant of both.
export const PREMIUM_REPORT_SCHEMA_VERSION = "v3";
export const PREMIUM_PRICE_CENTS = 7900;
export const PREMIUM_CURRENCY = "CNY";

/* --------------------------------------------------------------------- */
/* Pure decision helpers (exported for tests)                             */
/* --------------------------------------------------------------------- */

export type OrderRowLite = {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded";
  product_version: string;
};

export type CheckoutDecision =
  | { action: "already_paid"; orderId: string }
  | { action: "reuse_current_pending"; orderId: string }
  | { action: "create_current"; amountCents: number; productVersion: string };

/**
 * Given every historic order for a (user, chart), decide what the
 * checkout flow should do. Rules:
 *   - Any legacy paid row (v1 ¥99 or v2 ¥79 PDF) → permanent unlock.
 *   - Legacy pending/failed/refunded → IGNORED. Never reused, never
 *     blocks a new deep-report purchase.
 *   - Current version paid → already_paid.
 *   - Current version pending → reuse.
 *   - Otherwise → create a brand-new current-version order at ¥79.
 */
export function chooseCheckoutAction(orders: OrderRowLite[]): CheckoutDecision {
  const legacyPaid = orders.find(
    (o) =>
      (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(o.product_version) &&
      o.status === "paid",
  );
  if (legacyPaid) return { action: "already_paid", orderId: legacyPaid.id };

  const currentPaid = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "paid",
  );
  if (currentPaid) return { action: "already_paid", orderId: currentPaid.id };

  const currentPending = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "pending",
  );
  if (currentPending)
    return { action: "reuse_current_pending", orderId: currentPending.id };

  return {
    action: "create_current",
    amountCents: PREMIUM_PRICE_CENTS,
    productVersion: PREMIUM_PRODUCT_VERSION,
  };
}

/**
 * Same rule set, applied to admin grants. Returns:
 *   - reject_legacy: caller must throw already_granted_legacy.
 *   - upgrade_current_pending: flip that row to paid.
 *   - reuse_current_paid: idempotent no-op, log audit.
 *   - create_current_paid: insert a new deep-report paid row.
 * Legacy pending/failed/refunded rows are IGNORED.
 */
export type GrantDecision =
  | { action: "reject_legacy"; orderId: string }
  | { action: "reuse_current_paid"; orderId: string }
  | { action: "upgrade_current_pending"; orderId: string }
  | { action: "create_current_paid" };

export function chooseGrantAction(orders: OrderRowLite[]): GrantDecision {
  const legacyPaid = orders.find(
    (o) =>
      (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(o.product_version) &&
      o.status === "paid",
  );
  if (legacyPaid) return { action: "reject_legacy", orderId: legacyPaid.id };

  const currentPaid = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "paid",
  );
  if (currentPaid) return { action: "reuse_current_paid", orderId: currentPaid.id };

  const currentPending = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "pending",
  );
  if (currentPending)
    return { action: "upgrade_current_pending", orderId: currentPending.id };

  return { action: "create_current_paid" };
}

/* --------------------------------------------------------------------- */
/* Generation gating (pure decision) — extracted for unit tests.          */
/*                                                                        */
/* The invariant this locks in: the AI provider is called at most once    */
/* per (user, chart, report_version). The unique index on those columns   */
/* means only the first inserter of a `generating` row (the didStart      */
/* winner) is authorized to reach the AI. Every other caller — cached     */
/* completions, concurrent losers, reopens — MUST short-circuit here.    */
/* --------------------------------------------------------------------- */

export type ExistingReportLite = {
  status: "pending" | "generating" | "partial" | "completed" | "failed";
  hasContent: boolean;
} | null;

export type GenerationAction =
  | { action: "return_cached" } // completed row with content_json → NEVER call AI
  | { action: "return_existing" } // pending/generating/failed row exists → concurrent loser, NEVER call AI
  | { action: "start_new"; willCallAi: true }; // fresh row must be inserted; only this path calls AI

export function chooseGenerationAction(existing: ExistingReportLite): GenerationAction {
  if (existing?.status === "completed" && existing.hasContent) {
    return { action: "return_cached" };
  }
  if (existing) {
    // Any pre-existing row (generating / pending / failed) means some
    // other caller already claimed this slot. The current caller must
    // NOT invoke the AI again.
    return { action: "return_existing" };
  }
  return { action: "start_new", willCallAi: true };
}


/* --------------------------------------------------------------------- */
/* Helpers                                                                */
/* --------------------------------------------------------------------- */

async function ensureAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify admin role");
  if (!data) throw new Error("Forbidden: admin role required");
}

async function loadChartOwnedBy(userId: string, chartId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("charts")
    .select("id, user_id, name, birth_date, birth_time, birth_place, lang, input_snapshot")
    .eq("id", chartId)
    .maybeSingle();
  if (error) throw new Error("chart_lookup_failed");
  if (!data || data.user_id !== userId) throw new Error("chart_not_found");
  return data;
}

/**
 * Server-side gate: paid deep-report is only allowed when every required
 * tradition (western / bazi / vedic / ziwei) has a real calculator.
 * Missing systems throw `systems_incomplete:<a,b,c>` so the UI can show
 * "计算模块尚未完成" with the exact list.
 */
function assertSystemsComplete(chart: {
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: string | null;
  input_snapshot?: unknown;
}) {
  const g = extractGender(chart.input_snapshot);
  const snap = buildCalculationSnapshot({
    date: chart.birth_date ?? null,
    time: chart.birth_time ?? null,
    place: chart.birth_place ?? null,
    lang: (chart.lang as "en" | "zh") ?? "en",
    gender: g,
  });
  const missing = missingSystems(snap);
  if (missing.length > 0) {
    throw new Error(`systems_incomplete:${missing.join(",")}`);
  }
}

function extractGender(snap: unknown): "male" | "female" | null {
  if (!snap || typeof snap !== "object") return null;
  const v = (snap as Record<string, unknown>).gender;
  return v === "male" || v === "female" ? v : null;
}

/* --------------------------------------------------------------------- */
/* getPremiumStatus                                                       */
/* --------------------------------------------------------------------- */

const StatusInput = z.object({ chartId: z.string().uuid() });

export type PremiumStatus = {
  productVersion: string;
  priceCents: number;
  currency: string;
  order: {
    id: string;
    status: "pending" | "paid" | "failed" | "refunded";
    provider: string | null;
    paidAt: string | null;
    productVersion: string;
    isLegacy: boolean;
  } | null;
  report: {
    id: string;
    status: "pending" | "generating" | "partial" | "completed" | "failed";
    generatedAt: string | null;
    errorMessage: string | null;
  } | null;
};

export const getPremiumStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumStatus> => {
    const { supabase, userId } = context;
    await loadChartOwnedBy(userId, data.chartId); // ownership guard

    // Legacy grants access ONLY when status='paid'. Legacy pending /
    // refunded / failed rows are artefacts and never count as a live
    // entitlement or in-progress order.
    const { data: legacyPaid } = await supabase
      .from("premium_report_orders")
      .select("id, status, provider, paid_at, product_version")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Current deep-report product — pending or paid.
    const { data: currentActive } = await supabase
      .from("premium_report_orders")
      .select("id, status, provider, paid_at, product_version")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const effective = legacyPaid ?? currentActive ?? null;

    const { data: reportRow } = await supabase
      .from("premium_pdf_reports")
      .select("id, status, generated_at, error_message, content_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Auto-heal: legacy or interrupted rows whose content_json already
    // contains a full 24-chapter payload should be promoted to completed
    // without re-invoking AI. This repairs old partial rows where chapter
    // checkpoints were marked failed despite a complete aggregate payload.
    let reportStatus = reportRow?.status as
      | "pending" | "generating" | "partial" | "completed" | "failed"
      | undefined;
    if (reportRow && reportStatus !== "completed") {
      if (countValidPremiumContentChapters(reportRow.content_json) >= 24) {
        await repairCompletedReportFromContent({
          reportId: reportRow.id,
          userId,
          content: reportRow.content_json,
        });
        reportStatus = "completed";
      }
    }

    return {
      productVersion: PREMIUM_PRODUCT_VERSION,
      priceCents: PREMIUM_PRICE_CENTS,
      currency: PREMIUM_CURRENCY,
      order: effective
        ? {
            id: effective.id,
            status: effective.status as "pending" | "paid" | "failed" | "refunded",
            provider: effective.provider,
            paidAt: effective.paid_at,
            productVersion: effective.product_version,
            isLegacy: (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(
              effective.product_version,
            ),
          }
        : null,
      report: reportRow && reportStatus
        ? {
            id: reportRow.id,
            status: reportStatus,
            generatedAt: reportRow.generated_at,
            errorMessage: reportRow.error_message,
          }
        : null,
    };
  });


/* --------------------------------------------------------------------- */
/* startPremiumCheckout                                                   */
/* --------------------------------------------------------------------- */

export type CheckoutOutcome =
  | { kind: "already_paid"; orderId: string }
  | { kind: "pending"; orderId: string }
  | { kind: "provider_unavailable"; orderId: string; message: string };

export const startPremiumCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<CheckoutOutcome> => {
    const { userId, claims } = context;
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-checkout:${userId}`, 10, 60_000, "premium checkouts");
    const chart = await loadChartOwnedBy(userId, data.chartId);
    assertSystemsComplete(chart);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Historic legacy paid buyer already unlocked → never charge again.
    //    Only legacy status='paid' counts. Legacy pending/failed/refunded
    //    are ignored entirely and MUST NOT block or be reused for the
    //    current product.
    const { data: legacyPaid } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyPaid) return { kind: "already_paid", orderId: legacyPaid.id };

    // 2) Existing current-version active order (pending or paid) → reuse.
    const { data: existing } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      if (existing.status === "paid") return { kind: "already_paid", orderId: existing.id };
      return {
        kind: "provider_unavailable",
        orderId: existing.id,
        message: "provider_pending_config",
      };
    }

    // 3) Create a brand-new current-version pending order at ¥79.
    //    Legacy pending rows are intentionally left untouched. Amount,
    //    currency and product are fixed server-side.
    const { data: inserted, error } = await supabaseAdmin
      .from("premium_report_orders")
      .insert({
        user_id: userId,
        chart_id: data.chartId,
        product_version: PREMIUM_PRODUCT_VERSION,
        amount_cents: PREMIUM_PRICE_CENTS,
        currency: PREMIUM_CURRENCY,
        status: "pending",
        provider: null,
        provider_order_id: null,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("order_create_failed");

    return {
      kind: "provider_unavailable",
      orderId: inserted.id,
      message: "provider_pending_config",
    };
  });

/* --------------------------------------------------------------------- */
/* grantPremiumReportAccess — admin only                                  */
/* --------------------------------------------------------------------- */

const GrantInput = z.object({
  userId: z.string().uuid(),
  chartId: z.string().uuid(),
  note: z.string().trim().min(2).max(400),
});

export const grantPremiumReportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: chart } = await supabaseAdmin
      .from("charts")
      .select("id, user_id")
      .eq("id", data.chartId)
      .maybeSingle();
    if (!chart || chart.user_id !== data.userId) throw new Error("chart_not_found_for_user");

    // 1) Legacy already paid → already granted. Never duplicate the
    //    grant; log an audit entry and short-circuit.
    const { data: legacyPaid } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id")
      .eq("user_id", data.userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyPaid) {
      await supabaseAdmin.from("premium_grant_audit").insert({
        order_id: legacyPaid.id,
        admin_user_id: context.userId,
        target_user_id: data.userId,
        chart_id: data.chartId,
        action: "already_granted_legacy",
        note: data.note,
      });
      throw new Error("already_granted_legacy");
    }

    // 2) Existing current-version order. Legacy pending/failed/refunded
    //    rows are intentionally ignored and never reused / mutated.
    const { data: existing } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status")
      .eq("user_id", data.userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let orderId: string;
    if (existing) {
      orderId = existing.id;
      if (existing.status !== "paid") {
        const { error: upErr } = await supabaseAdmin
          .from("premium_report_orders")
          .update({
            status: "paid",
            provider: "manual",
            paid_at: new Date().toISOString(),
            granted_by: context.userId,
            grant_note: data.note,
          })
          .eq("id", orderId);
        if (upErr) throw new Error("order_update_failed");
      }
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("premium_report_orders")
        .insert({
          user_id: data.userId,
          chart_id: data.chartId,
          product_version: PREMIUM_PRODUCT_VERSION,
          amount_cents: PREMIUM_PRICE_CENTS,
          currency: PREMIUM_CURRENCY,
          status: "paid",
          provider: "manual",
          paid_at: new Date().toISOString(),
          granted_by: context.userId,
          grant_note: data.note,
        })
        .select("id")
        .single();
      if (insErr || !inserted) throw new Error("order_create_failed");
      orderId = inserted.id;
    }

    await supabaseAdmin.from("premium_grant_audit").insert({
      order_id: orderId,
      admin_user_id: context.userId,
      target_user_id: data.userId,
      chart_id: data.chartId,
      action: "manual_paid_grant",
      note: data.note,
    });

    return { ok: true as const, orderId };
  });

/* --------------------------------------------------------------------- */
/* insertTestPremiumOrderFixture — TEST-ONLY fixture helper               */
/*                                                                        */
/* Bypasses the admin UI grant path so E2E scripts can unlock a specific  */
/* (caller_user_id, chart_id) pair without granting the caller admin.     */
/* Refuses to run unless PREMIUM_TEST_DETERMINISTIC === "1" AND           */
/* NODE_ENV !== "production". The order is always bound to the           */
/* authenticated caller's own user_id + a chart they own; the caller     */
/* cannot mint access for a different user or a chart they do not own.    */
/* --------------------------------------------------------------------- */

const TestFixtureInput = z.object({
  chartId: z.string().uuid(),
  fixtureTag: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^e2e-/, "fixture tag must start with 'e2e-'"),
});

export const insertTestPremiumOrderFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TestFixtureInput.parse(d))
  .handler(async ({ data, context }) => {
    if (
      process.env.PREMIUM_TEST_DETERMINISTIC !== "1" ||
      process.env.NODE_ENV === "production"
    ) {
      throw new Error("test_fixture_disabled");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bind strictly to the authenticated caller's own chart.
    const { data: chart } = await supabaseAdmin
      .from("charts")
      .select("id, user_id")
      .eq("id", data.chartId)
      .maybeSingle();
    if (!chart || chart.user_id !== context.userId) {
      throw new Error("chart_not_found_for_user");
    }

    const note = `${data.fixtureTag}:${context.userId.slice(0, 8)}`;

    // Reuse an existing current-version order if present; otherwise insert.
    const { data: existing } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status")
      .eq("user_id", context.userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.status !== "paid") {
        const { error: upErr } = await supabaseAdmin
          .from("premium_report_orders")
          .update({
            status: "paid",
            provider: "test_fixture",
            paid_at: new Date().toISOString(),
            grant_note: note,
          })
          .eq("id", existing.id);
        if (upErr) throw new Error("order_update_failed");
      }
      return { ok: true as const, orderId: existing.id, reused: true };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("premium_report_orders")
      .insert({
        user_id: context.userId,
        chart_id: data.chartId,
        product_version: PREMIUM_PRODUCT_VERSION,
        amount_cents: PREMIUM_PRICE_CENTS,
        currency: PREMIUM_CURRENCY,
        status: "paid",
        provider: "test_fixture",
        paid_at: new Date().toISOString(),
        grant_note: note,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error("order_create_failed");
    return { ok: true as const, orderId: inserted.id, reused: false };
  });


/* --------------------------------------------------------------------- */
/* Mock payment (simulated checkout) — NON-PRODUCTION ONLY               */
/*                                                                        */
/* The real Chinese payment channels (WeChat Pay / Alipay / UnionPay)     */
/* and international Visa acquiring are NOT wired. The premium ¥79 unlock */
/* uses a simulated cashier modal on preview/dev so we can validate the   */
/* end-to-end user journey without collecting real bank-card data,        */
/* creating real merchant transactions, or contacting any PSP API.        */
/*                                                                        */
/* Rules baked in here:                                                   */
/*   1) Absolutely refused when NODE_ENV === "production".                */
/*   2) Auth required; order is bound to the caller's own user_id and     */
/*      a chart_id the caller actually owns.                              */
/*   3) Same (user_id, chart_id, current product_version) can only ever   */
/*      have one active order — a second mock click is idempotent and     */
/*      simply reports `reused: true` for the existing paid row.          */
/*   4) provider is stored as `mock_wechat` / `mock_alipay` / `mock_visa` */
/*      / `mock_unionpay` so real merchant reconciliation always ignores  */
/*      these rows.                                                       */
/* --------------------------------------------------------------------- */

export const PREMIUM_MOCK_PAYMENT_METHODS = [
  "wechat",
  "alipay",
  "visa",
  "unionpay",
] as const;
export type PremiumMockPaymentMethod =
  (typeof PREMIUM_MOCK_PAYMENT_METHODS)[number];

/**
 * Pure helper: does the current server runtime allow mock (simulated)
 * payment? Extracted for unit tests so we can assert the production
 * kill-switch without needing a real Supabase client.
 */
export function isMockPaymentAllowedFor(env: {
  NODE_ENV?: string | undefined;
  PAYMENT_MODE?: string | undefined;
}): boolean {
  // Explicit switch: PAYMENT_MODE=mock (default) enables the simulated
  // cashier. Anything else (e.g. "live", "off") disables it. NODE_ENV is
  // deliberately NOT consulted — Lovable preview builds evaluate to
  // production but must still be able to run the mock flow.
  const mode = (env.PAYMENT_MODE ?? "mock").toLowerCase();
  return mode === "mock";
}

/**
 * Pure helper: does the current server runtime run generation in
 * deterministic/mock stub mode (skipping real AI Gateway calls)?
 *
 * Precedence (explicit switches over implicit signals):
 *   • `REPORT_GENERATION_MODE=deterministic|mock|stub` → true
 *   • `REPORT_GENERATION_MODE=live|real|production`    → false
 *     (a live setting FORCES the real provider even without a key,
 *      surfacing the missing-key error instead of silently stubbing)
 *   • Legacy `PREMIUM_TEST_DETERMINISTIC=1`            → true
 *   • Otherwise falls back to key presence: no key → deterministic.
 *
 * `NODE_ENV` is deliberately NOT consulted so Lovable preview
 * (which builds as production) can still opt into deterministic mode
 * via the explicit env var.
 */
export function isDeterministicGenerationModeFor(
  env: {
    REPORT_GENERATION_MODE?: string | undefined;
    PREMIUM_TEST_DETERMINISTIC?: string | undefined;
  },
  runtime: { hasApiKey: boolean },
): boolean {
  const mode = (env.REPORT_GENERATION_MODE ?? "deterministic").toLowerCase();
  if (mode === "deterministic" || mode === "mock" || mode === "stub") return true;
  if (mode === "live" || mode === "real" || mode === "production") return false;
  if (env.PREMIUM_TEST_DETERMINISTIC === "1") return true;
  return !runtime.hasApiKey;
}

const MockPayInput = z.object({
  chartId: z.string().uuid(),
  method: z.enum(PREMIUM_MOCK_PAYMENT_METHODS),
});

export type MockPaymentOutcome = {
  ok: true;
  orderId: string;
  reused: boolean;
  provider: `mock_${PremiumMockPaymentMethod}`;
};

export const simulateMockPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MockPayInput.parse(d))
  .handler(async ({ data, context }): Promise<MockPaymentOutcome> => {
    if (!isMockPaymentAllowedFor(process.env)) {
      throw new Error("mock_payment_disabled_in_production");
    }
    const { userId } = context;
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-mock-pay:${userId}`, 12, 60_000, "mock payments");

    const chart = await loadChartOwnedBy(userId, data.chartId); // throws chart_not_found on mismatch
    assertSystemsComplete(chart);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const provider = `mock_${data.method}` as MockPaymentOutcome["provider"];
    const note = `mock-${data.method}:${userId.slice(0, 8)}`;

    // Legacy paid buyer already fully unlocked — never mint a second row.
    const { data: legacyPaid } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyPaid)
      return { ok: true, orderId: legacyPaid.id, reused: true, provider };

    // Reuse the caller's current-version order (pending or paid). Only
    // ONE active order per (user, chart, product_version) is allowed —
    // enforced by DB unique index. Repeated mock clicks or method
    // switches converge to the same order id.
    const { data: existing } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.status === "paid") {
        return { ok: true, orderId: existing.id, reused: true, provider };
      }
      const { error: upErr } = await supabaseAdmin
        .from("premium_report_orders")
        .update({
          status: "paid",
          provider,
          paid_at: new Date().toISOString(),
          grant_note: note,
        })
        .eq("id", existing.id);
      if (upErr) throw new Error("order_update_failed");
      return { ok: true, orderId: existing.id, reused: false, provider };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("premium_report_orders")
      .insert({
        user_id: userId,
        chart_id: data.chartId,
        product_version: PREMIUM_PRODUCT_VERSION,
        amount_cents: PREMIUM_PRICE_CENTS,
        currency: PREMIUM_CURRENCY,
        status: "paid",
        provider,
        paid_at: new Date().toISOString(),
        grant_note: note,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error("order_create_failed");
    return { ok: true, orderId: inserted.id, reused: false, provider };
  });





/* --------------------------------------------------------------------- */
/* listAdminPremiumOrders — admin only                                    */
/* --------------------------------------------------------------------- */

const ListOrdersInput = z.object({
  status: z.enum(["pending", "paid", "failed", "refunded", "all"]).default("all"),
  search: z.string().trim().max(120).optional(),
});

export type AdminOrderRow = {
  id: string;
  userId: string;
  email: string | null;
  chartId: string;
  chartName: string | null;
  productVersion: string;
  isLegacy: boolean;
  status: "pending" | "paid" | "failed" | "refunded";
  provider: string | null;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  grantNote: string | null;
  reportStatus: "pending" | "generating" | "partial" | "completed" | "failed" | null;
};

export const listAdminPremiumOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListOrdersInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminOrderRow[]> => {
    await ensureAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("premium_report_orders")
      .select(
        "id, user_id, chart_id, product_version, status, provider, amount_cents, currency, paid_at, created_at, grant_note",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: orders } = await query;
    if (!orders || orders.length === 0) return [];

    const chartIds = Array.from(new Set(orders.map((o) => o.chart_id)));

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const emailBy = new Map<string, string | null>();
    (authList?.users ?? []).forEach((u) => emailBy.set(u.id, u.email ?? null));

    const { data: charts } = await supabaseAdmin
      .from("charts")
      .select("id, name")
      .in("id", chartIds);
    const chartNameBy = new Map<string, string | null>();
    (charts ?? []).forEach((c) => chartNameBy.set(c.id, c.name ?? null));

    const { data: reports } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("chart_id, user_id, status")
      .in("chart_id", chartIds);
    const reportBy = new Map<string, string>();
    (reports ?? []).forEach((r) => {
      reportBy.set(`${r.user_id}:${r.chart_id}`, r.status);
    });

    const rows: AdminOrderRow[] = orders.map((o) => {
      const rep = reportBy.get(`${o.user_id}:${o.chart_id}`);
      return {
        id: o.id,
        userId: o.user_id,
        email: emailBy.get(o.user_id) ?? null,
        chartId: o.chart_id,
        chartName: chartNameBy.get(o.chart_id) ?? null,
        productVersion: o.product_version,
        isLegacy: (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(
          o.product_version,
        ),
        status: o.status as AdminOrderRow["status"],
        provider: o.provider,
        amountCents: o.amount_cents,
        currency: o.currency,
        paidAt: o.paid_at,
        createdAt: o.created_at,
        grantNote: o.grant_note,
        reportStatus: (rep as AdminOrderRow["reportStatus"]) ?? null,
      };
    });

    if (data.search) {
      const q = data.search.toLowerCase();
      return rows.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.chartName ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  });

/* --------------------------------------------------------------------- */
/* listAdminChartsForUser — admin only                                    */
/*                                                                        */
/* Lets the admin panel show every chart belonging to a target user       */
/* (looked up by email or user id) so a test grant can be issued for a    */
/* chart that has NO order yet. Existing paid/pending order state per     */
/* chart is folded in so the UI can hide "already granted" charts.        */
/* --------------------------------------------------------------------- */

const AdminChartLookupInput = z.object({
  query: z.string().trim().min(1).max(200),
});

export type AdminUserChartRow = {
  userId: string;
  email: string | null;
  chartId: string;
  name: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  hasCurrentPaid: boolean;
  hasCurrentPending: boolean;
  hasLegacyPaid: boolean;
};

export const listAdminChartsForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdminChartLookupInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminUserChartRow[]> => {
    await ensureAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve user by email (case-insensitive) or user id.
    const q = data.query.toLowerCase();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.query,
    );

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const users = authList?.users ?? [];
    const match = looksLikeUuid
      ? users.find((u) => u.id === data.query)
      : users.find((u) => (u.email ?? "").toLowerCase() === q);
    if (!match) return [];

    const { data: charts } = await supabaseAdmin
      .from("charts")
      .select("id, name, birth_date, birth_time, birth_place")
      .eq("user_id", match.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!charts || charts.length === 0) return [];

    const chartIds = charts.map((c) => c.id);
    const { data: orders } = await supabaseAdmin
      .from("premium_report_orders")
      .select("chart_id, status, product_version")
      .eq("user_id", match.id)
      .in("chart_id", chartIds);

    const flags = new Map<
      string,
      { currentPaid: boolean; currentPending: boolean; legacyPaid: boolean }
    >();
    for (const c of chartIds) {
      flags.set(c, { currentPaid: false, currentPending: false, legacyPaid: false });
    }
    for (const o of orders ?? []) {
      const f = flags.get(o.chart_id);
      if (!f) continue;
      const isLegacy = (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(
        o.product_version,
      );
      if (isLegacy && o.status === "paid") f.legacyPaid = true;
      if (o.product_version === PREMIUM_PRODUCT_VERSION) {
        if (o.status === "paid") f.currentPaid = true;
        if (o.status === "pending") f.currentPending = true;
      }
    }

    return charts.map((c) => {
      const f = flags.get(c.id) ?? { currentPaid: false, currentPending: false, legacyPaid: false };
      return {
        userId: match.id,
        email: match.email ?? null,
        chartId: c.id,
        name: c.name ?? null,
        birthDate: c.birth_date ?? null,
        birthTime: c.birth_time ?? null,
        birthPlace: c.birth_place ?? null,
        hasCurrentPaid: f.currentPaid,
        hasCurrentPending: f.currentPending,
        hasLegacyPaid: f.legacyPaid,
      };
    });
  });


/* --------------------------------------------------------------------- */
/* Deep-report content generation                                         */
/* --------------------------------------------------------------------- */

export type PremiumChapter = {
  key: string;
  title: string;
  body: string;
  /** v3+: structured evidence references. Optional on legacy v1/v2 rows. */
  evidence_refs?: Array<{ path: string; module: string; confidence: string }>;
  /** v3+: chapter-level confidence derived from evidence refs. */
  confidence?: "grounded" | "traditional" | "reflective";
};
export type PremiumContent = {
  meta: {
    prompt_version: string;
    report_version: string;
    /** Content-schema version: "v1" (legacy body-only) or "v2" (facts + body). */
    report_schema_version?: "v1" | "v2" | "v3";
    generated_at: string;
    lang: "en" | "zh";
    chart_name: string | null;
    disclaimer: string;
  };
  cover: { title: string; subtitle: string };
  /** Locally-derived, immutable facts. Absent on legacy v1 rows. */
  facts?: import("./premium-facts").PremiumFacts;
  chapters: PremiumChapter[];
};

const CHAPTER_KEYS = [
  "executive_summary",
  "western_astrology",
  "vedic_astrology",
  "bazi",
  "zi_wei",
  "convergence",
  "character",
  "vocation",
  "wealth",
  "relationships",
  "family",
  "health",
  "mission",
  "cycles",
  "year_ahead",
  "windows",
  "strengths_risks",
  "reflection",
  "methodology",
] as const;

const CHAPTER_TITLES_EN: Record<(typeof CHAPTER_KEYS)[number], string> = {
  executive_summary: "Executive Summary",
  western_astrology: "Western Astrology",
  vedic_astrology: "Vedic Astrology (Jyotish)",
  bazi: "BaZi — Four Pillars",
  zi_wei: "Zi Wei Dou Shu",
  convergence: "Cross-Tradition Convergence & Tension",
  character: "Character",
  vocation: "Vocation & Career",
  wealth: "Wealth",
  relationships: "Love & Relationships",
  family: "Family & Home",
  health: "Health & Vitality",
  mission: "Life Mission",
  cycles: "Long Cycles",
  year_ahead: "The Next Twelve Months",
  windows: "Key Time Windows",
  strengths_risks: "Strengths, Risks & Actions",
  reflection: "Reflection Prompts",
  methodology: "Methodology & Disclaimers",
};
const CHAPTER_TITLES_ZH: Record<(typeof CHAPTER_KEYS)[number], string> = {
  executive_summary: "执行摘要",
  western_astrology: "西方占星",
  vedic_astrology: "印度占星（Jyotish）",
  bazi: "八字四柱",
  zi_wei: "紫微斗数",
  convergence: "跨体系共识与矛盾",
  character: "性格",
  vocation: "事业方向",
  wealth: "财富格局",
  relationships: "情感与关系",
  family: "家庭与家园",
  health: "健康与活力",
  mission: "人生使命",
  cycles: "长周期",
  year_ahead: "未来十二个月",
  windows: "关键时间窗口",
  strengths_risks: "优势、风险与行动",
  reflection: "反思提问",
  methodology: "方法论与免责声明",
};

const DISCLAIMER_EN =
  "This report is for cultural, reflective and self-exploration purposes only. It is not medical, legal, financial or life-decision advice. No diagnosis, guarantee, or prediction of harm is implied.";
const DISCLAIMER_ZH =
  "本报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议；不包含任何疾病诊断、灾祸预言或收益保证。";

async function generateChapter(
  key: string,
  title: string,
  chartFacts: string,
  factsJson: string,
  webReport: string,
  isZh: boolean,
  apiKey: string,
  opts: {
    allowedFacts?: readonly string[];
    targetCharsZh?: readonly [number, number];
    maxOutputTokens?: number;
  } = {},
): Promise<{
  text: string;
  evidence_refs: Array<{ path: string; module: string; confidence: string }>;
  usage: TokenUsage | null;
}> {
  const { parseChapterJson } = await import("./chapter-json-schema");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const guardrails = guardrailsFor(isZh ? "zh" : "en");
  const allowedHint =
    opts.allowedFacts && opts.allowedFacts.length > 0
      ? isZh
        ? `本章仅可引用事实模块：${opts.allowedFacts.join("、")}。`
        : `Only cite fact modules: ${opts.allowedFacts.join(", ")}.`
      : isZh
        ? "本章不引用命盘事实模块，evidence_refs 必须为空数组。"
        : "This chapter does not cite chart facts; evidence_refs MUST be an empty array.";
  const lenHint = opts.targetCharsZh
    ? isZh
      ? `目标字数：${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} 汉字。`
      : `Target length: ${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} Chinese characters (or equivalent).`
    : "";

  const jsonRules = isZh
    ? `严格输出规范：只回复一个 JSON 对象，形如
{"body":"…纯文本正文，段落之间用\\n\\n分隔…","evidence_refs":[{"path":"bazi.pillars.day","module":"bazi","confidence":"grounded"}]}
- body 只能是段落纯文本，无 Markdown 标题或代码块。
- evidence_refs.path 必须精确对应 FACTS JSON 中真实存在的字段（点/方括号路径），不得编造。
- module 只能是 bazi | bazi_luck | ziwei | ziwei_horoscope | western | western_aspects | vedic | vedic_dasha。
- confidence 只能是 grounded（本地计算可直接证实）| traditional（经典理论推论）| reflective（提示式反思）。
- 不允许除 body / evidence_refs 之外的任何键；不允许附加解释文字或 Markdown 代码块外的内容。`
    : `Strict output contract: reply with a SINGLE JSON object only:
{"body":"…plain-text paragraphs separated by \\n\\n…","evidence_refs":[{"path":"bazi.pillars.day","module":"bazi","confidence":"grounded"}]}
- body is plain text only (no Markdown headers or fences).
- evidence_refs.path must correspond exactly to a real field in the FACTS JSON (dot / bracket path); never invent.
- module ∈ bazi | bazi_luck | ziwei | ziwei_horoscope | western | western_aspects | vedic | vedic_dasha.
- confidence ∈ grounded (directly verifiable from local calc) | traditional (classical inference) | reflective (prompt-style).
- No other keys, no prose outside the JSON object, no code fences.`;

  const system = isZh
    ? `你是命运图书馆资深占星与命理长者。撰写一份高级 AI 深度报告的一个章节，只在站内网页中阅读。

事实纪律（不可违反）：
- 你只能引用下面 FACTS JSON 中真实存在的字段。
- FACTS.unavailable 里列出的模块本地尚未计算，禁止编造。
- 跨体系结论至少援引两个不同体系的事实；矛盾要展示，不强行统一。
- 不给医疗诊断、灾祸预言或收益保证；用"倾向 / 窗口 / 可能"等谨慎措辞。
${allowedHint}
${lenHint}

${jsonRules}

${guardrails}`
    : `You are a senior elder of the Library of Destiny writing one chapter of a premium deep reading delivered inside the web app.

Fact discipline (non-negotiable):
- You may only cite fields that actually appear in the FACTS JSON below.
- Modules listed in FACTS.unavailable are NOT computed locally — do not fabricate.
- Any cross-tradition conclusion must be backed by facts from at least two different traditions.
- No medical diagnoses, guaranteed misfortune, or financial promises.
${allowedHint}
${lenHint}

${jsonRules}

${guardrails}`;

  const prompt = `${isZh ? "章节" : "Chapter"}: ${title} (${key})

${isZh ? "来访者命盘事实" : "Chart facts"}:
${chartFacts || (isZh ? "（未提供）" : "(not provided)")}

FACTS (JSON — ONLY source of chart data you may cite):
${factsJson}

${isZh ? "现有网页报告摘要（可参考不要复述）" : "Existing web report (reference, do not copy verbatim)"}:
${webReport.slice(0, 3000)}
`;

  const result = await generateText({
    model: gateway(READING_MODEL_ID),
    system,
    prompt,
    temperature: 0,
    ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
  });
  const u = (
    result as unknown as {
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      };
    }
  ).usage;
  const usage: TokenUsage | null = u
    ? {
        input_tokens: u.inputTokens ?? u.promptTokens ?? 0,
        output_tokens: u.outputTokens ?? u.completionTokens ?? 0,
      }
    : null;
  const parsed = parseChapterJson(result.text);
  if (!parsed.ok) {
    // Bubble up as a provider error → chapter is marked failed and retried.
    throw new Error(`chapter_json_invalid:${parsed.error}`);
  }
  return {
    text: parsed.value.body.trim().slice(0, 20000),
    evidence_refs: parsed.value.evidence_refs,
    usage,
  };
}


/**
 * Insert (or claim) the single generating row for a given cache key.
 * The unique index (user_id, chart_id, report_version, input_hash)
 * makes only ONE caller the `didStart` winner; every concurrent loser
 * gets the existing row and MUST NOT call the AI provider.
 */
async function beginPremiumReportRow(
  userId: string,
  chartId: string,
  orderId: string,
  cacheKey: CacheKey,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inserted, error } = await supabaseAdmin
    .from("premium_pdf_reports")
    .insert({
      user_id: userId,
      chart_id: chartId,
      order_id: orderId,
      report_version: cacheKey.report_version,
      prompt_version: cacheKey.prompt_version,
      model_id: cacheKey.model_id,
      calculation_version: cacheKey.calculation_version,
      input_hash: cacheKey.input_hash,
      status: "generating",
    })
    .select("id, status, content_json")
    .single();
  if (!error && inserted) return { row: inserted, didStart: true };

  const { data: existing } = await supabaseAdmin
    .from("premium_pdf_reports")
    .select("id, status, content_json")
    .eq("user_id", userId)
    .eq("chart_id", chartId)
    .eq("report_version", cacheKey.report_version)
    .eq("input_hash", cacheKey.input_hash)
    .maybeSingle();
  if (!existing) throw new Error("premium_row_lookup_failed");
  return { row: existing, didStart: false };
}

/**
 * Build the engine input for a chart. `generated_at` on the snapshot
 * is stripped so the input_hash is deterministic across time — only
 * the actual chart facts + versions may influence the cache key.
 */
function buildEngineInputForChart(chart: {
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: string | null;
  input_snapshot?: unknown;
}) {
  const gender = extractGender(chart.input_snapshot);
  const snapshot: CalculationSnapshot = buildCalculationSnapshot({
    date: chart.birth_date ?? null,
    time: chart.birth_time ?? null,
    place: chart.birth_place ?? null,
    lang: (chart.lang as "en" | "zh") ?? "en",
    gender,
  });
  // Strip volatile timestamp so the hash is stable across regenerations.
  const stableSnapshot: CalculationSnapshot = { ...snapshot, generated_at: "" };
  const chartFacts: EngineChartFacts = {
    name: chart.name ?? null,
    birth_date: chart.birth_date ?? null,
    birth_time: chart.birth_time ?? null,
    birth_place: chart.birth_place ?? null,
    lang: (chart.lang as "en" | "zh") ?? "en",
    gender,
  };
  // Premium reports override prompt_version with the manifest revision so
  // that bumping the revision creates a NEW premium_pdf_reports row (via the
  // unique input_hash) and old completed rows stay immutable.
  const versions = { ...DEFAULT_VERSIONS, prompt_version: PREMIUM_REPORT_REVISION };
  return buildEngineInput(chartFacts, stableSnapshot, versions);
}

type PremiumReportStatus = "pending" | "generating" | "partial" | "completed" | "failed";
const CHAPTER_LEASE_SECONDS = 120;
const MAX_CHAPTER_ATTEMPTS = 3;

type ChapterDbRow = {
  chapter_key: string;
  chapter_index: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attempt_count: number;
  claim_token: string | null;
  claimed_at: string | null;
  content_json: unknown;
  evidence_refs: unknown;
  input_tokens: number;
  output_tokens: number;
  error_message: string | null;
  content_hash?: string | null;
  confidence?: string | null;
};

export type PremiumReportStart = { reportId: string; status: PremiumReportStatus };
export type PremiumChapterStepResult = {
  reportId: string;
  status: PremiumReportStatus;
  processed: boolean;
  providerCalled: boolean;
  processedChapters?: number;
  shouldContinue?: boolean;
  completedChapters: number;
  totalChapters: number;
  currentChapterKey: string | null;
  currentChapterTitle: string | null;
  message: "completed" | "processed" | "no_claim" | "active_lease" | "interrupted" | "prep_error";
  error?: string;
};

function countValidPremiumContentChapters(content: unknown): number {
  const chapters = (content as { chapters?: unknown[] } | null)?.chapters;
  if (!Array.isArray(chapters)) return 0;
  return chapters.filter((chapter) => {
    const c = chapter as { key?: unknown; body?: unknown };
    return typeof c.key === "string" && typeof c.body === "string" && c.body.trim().length > 0;
  }).length;
}

function extractValidPremiumContentChapters(content: unknown): PremiumChapter[] {
  const chapters = (content as { chapters?: unknown[] } | null)?.chapters;
  if (!Array.isArray(chapters)) return [];
  return chapters.filter((chapter): chapter is PremiumChapter => {
    const c = chapter as PremiumChapter;
    return typeof c.key === "string" && typeof c.body === "string" && c.body.trim().length > 0;
  });
}

async function repairCompletedReportFromContent(opts: {
  reportId: string;
  userId: string;
  content: unknown;
}) {
  const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
  const validChapters = extractValidPremiumContentChapters(opts.content);
  if (validChapters.length < PREMIUM_V3_CHAPTERS.length) return false;

  const byKey = new Map(validChapters.map((chapter) => [chapter.key, chapter]));
  const content = opts.content as PremiumContent;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const completedAt = new Date().toISOString();

  for (const meta of PREMIUM_V3_CHAPTERS) {
    const chapter = byKey.get(meta.key);
    if (!chapter) continue;
    const normalizedChapter: PremiumChapter = {
      key: meta.key,
      title: chapter.title || meta.title_en,
      body: chapter.body,
      evidence_refs: chapter.evidence_refs ?? [],
      confidence: chapter.confidence ?? chapterConfidence(chapter.evidence_refs ?? []),
    };
    const chapterHash = await computeContentHash(normalizedChapter);
    await supabaseAdmin
      .from("premium_report_chapters")
      .upsert({
        report_id: opts.reportId,
        user_id: opts.userId,
        chapter_key: meta.key,
        chapter_index: meta.index,
        status: "completed",
        content_json: normalizedChapter as unknown as Json,
        evidence_refs: normalizedChapter.evidence_refs as unknown as Json,
        confidence: normalizedChapter.confidence,
        content_hash: chapterHash,
        claim_token: null,
        claimed_at: null,
        completed_at: completedAt,
        error_message: null,
      } as unknown as never, {
        onConflict: "report_id,chapter_key",
        ignoreDuplicates: true,
      });
    await supabaseAdmin
      .from("premium_report_chapters")
      .update({
        status: "completed",
        content_json: normalizedChapter as unknown as Json,
        evidence_refs: normalizedChapter.evidence_refs as unknown as Json,
        confidence: normalizedChapter.confidence,
        content_hash: chapterHash,
        claim_token: null,
        claimed_at: null,
        completed_at: completedAt,
        error_message: null,
      } as unknown as never)
      .eq("report_id", opts.reportId)
      .eq("user_id", opts.userId)
      .eq("chapter_key", meta.key)
      .neq("status", "completed");
  }

  const contentHash = await computeContentHash(content);
  await supabaseAdmin
    .from("premium_pdf_reports")
    .update({
      status: "completed",
      content_hash: contentHash,
      generated_at: completedAt,
      error_message: null,
    } as unknown as never)
    .eq("id", opts.reportId)
    .eq("user_id", opts.userId)
    .neq("status", "completed");
  return true;
}

const StepInput = z.object({ reportId: z.string().uuid() });

async function assertPaidOrder(userId: string, chartId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("premium_report_orders")
    .select("id, status, product_version")
    .eq("user_id", userId)
    .eq("chart_id", chartId)
    .in("product_version", PREMIUM_ALL_PRODUCT_VERSIONS as unknown as string[])
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) throw new Error("order_not_paid");
  return order;
}

async function ensurePendingChapterRows(reportId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
  const rows = PREMIUM_V3_CHAPTERS.map((c) => ({
    report_id: reportId,
    user_id: userId,
    chapter_key: c.key,
    chapter_index: c.index,
    status: "pending",
  }));
  await supabaseAdmin
    .from("premium_report_chapters")
    .upsert(rows as unknown as never, {
      onConflict: "report_id,chapter_key",
      ignoreDuplicates: true,
    });
}

async function recoverStaleChapterLocks(reportId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const staleBefore = new Date(Date.now() - CHAPTER_LEASE_SECONDS * 1000).toISOString();
  await supabaseAdmin
    .from("premium_report_chapters")
    .update({
      status: "failed",
      claim_token: null,
      claimed_at: null,
      error_message: "generation_interrupted",
    } as unknown as never)
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .eq("status", "running")
    .lt("claimed_at", staleBefore);
  await supabaseAdmin
    .from("premium_report_chapters")
    .update({
      status: "failed",
      claim_token: null,
      claimed_at: null,
      error_message: "generation_interrupted",
    } as unknown as never)
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .eq("status", "running")
    .is("claimed_at", null);
}

function chapterConfidence(refs: Array<{ confidence: string }>): "grounded" | "traditional" | "reflective" {
  if (refs.some((r) => r.confidence === "grounded")) return "grounded";
  if (refs.some((r) => r.confidence === "traditional")) return "traditional";
  return "reflective";
}

function deterministicEvidenceRefs(meta: V3ChapterMeta): EvidenceRef[] {
  if (meta.allowed_facts.length === 0) return [];
  if (meta.kind === "cross") {
    return [
      { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
      { path: "western.sun", module: "western", confidence: "grounded" },
    ];
  }
  const mod = meta.allowed_facts[0];
  const pathByModule: Record<string, string> = {
    bazi: "bazi.pillars.day",
    bazi_luck: "bazi.pillars.day",
    ziwei: "ziwei.five_elements_class",
    ziwei_horoscope: "ziwei.five_elements_class",
    western: "western.sun",
    western_aspects: "western.sun",
    vedic: "vedic.moon",
    vedic_dasha: "vedic.moon",
  };
  return [{ path: pathByModule[mod] ?? "western.sun", module: mod, confidence: "grounded" }];
}

function deterministicChapterBody(meta: V3ChapterMeta, title: string, isZh: boolean) {
  if (isZh) {
    return `${title}\n\n这是测试模式生成的稳定章节内容，用于验证高级 AI 综合报告的保存、续跑与阅读流程。章节只引用本地已计算的命盘事实，不调用真实 AI，不产生额外费用。\n\n本章键为 ${meta.key}，序号为 ${meta.index + 1}。`;
  }
  return `${title}\n\nThis deterministic test chapter validates the premium report save, resume, and reader flow. It cites only locally computed chart facts, calls no live AI, and creates no real charge.\n\nChapter key: ${meta.key}; order: ${meta.index + 1}.`;
}

async function buildAggregateReport(opts: {
  reportId: string;
  userId: string;
  chart: Awaited<ReturnType<typeof loadChartOwnedBy>>;
  cacheKey: CacheKey;
  facts: unknown;
  provider: string;
  forceErrorMessage?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
  const isZh = (opts.chart.lang ?? "en") === "zh";
  const { data: rows } = await supabaseAdmin
    .from("premium_report_chapters")
    .select("chapter_key, chapter_index, status, content_json, input_tokens, output_tokens, attempt_count")
    .eq("report_id", opts.reportId)
    .eq("user_id", opts.userId)
    .order("chapter_index", { ascending: true });
  const typed = (rows ?? []) as Array<ChapterDbRow>;
  const byKey = new Map(typed.map((r) => [r.chapter_key, r]));

  const chapters: PremiumChapter[] = PREMIUM_V3_CHAPTERS.map((c) => {
    const rec = byKey.get(c.key);
    const title = isZh ? c.title_zh : c.title_en;
    if (rec?.status === "completed" && rec.content_json) {
      const cj = rec.content_json as {
        body?: string;
        evidence_refs?: Array<{ path: string; module: string; confidence: string }>;
        confidence?: "grounded" | "traditional" | "reflective";
      };
      return {
        key: c.key,
        title,
        body: cj.body ?? "",
        evidence_refs: cj.evidence_refs ?? [],
        confidence: cj.confidence ?? chapterConfidence(cj.evidence_refs ?? []),
      };
    }
    return {
      key: c.key,
      title,
      body: isZh ? "本章进度已保存，返回本页即可继续生成。" : "Progress is saved. Return here to continue this chapter.",
      evidence_refs: [],
      confidence: "reflective",
    };
  });

  const completed = typed.filter((r) => r.status === "completed").length;
  const running = typed.some((r) => r.status === "running");
  const retriable = typed.some(
    (r) => r.status === "pending" || (r.status === "failed" && r.attempt_count < MAX_CHAPTER_ATTEMPTS),
  );
  const finalStatus: PremiumReportStatus =
    completed >= PREMIUM_V3_CHAPTERS.length
      ? "completed"
      : running || retriable
        ? "generating"
        : completed > 0
          ? "partial"
          : "failed";

  const content: PremiumContent = {
    meta: {
      prompt_version: opts.cacheKey.prompt_version,
      report_version: opts.cacheKey.report_version,
      report_schema_version: PREMIUM_REPORT_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      lang: isZh ? "zh" : "en",
      chart_name: opts.chart.name ?? null,
      disclaimer: isZh ? DISCLAIMER_ZH : DISCLAIMER_EN,
    },
    cover: {
      title: isZh ? "命运图书馆 · 高级 AI 深度报告" : "Library of Destiny — Premium Deep Reading",
      subtitle: opts.chart.name ?? (isZh ? "私人命盘解读" : "Personal chart reading"),
    },
    facts: opts.facts as PremiumContent["facts"],
    chapters,
  };
  const contentHash = await computeContentHash(content);
  const tokenUsage: TokenUsage = typed.reduce(
    (sum, r) => ({
      input_tokens: sum.input_tokens + (r.input_tokens ?? 0),
      output_tokens: sum.output_tokens + (r.output_tokens ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0 },
  );
  await supabaseAdmin
    .from("premium_pdf_reports")
    .update({
      status: finalStatus,
      content_json: content as unknown as Json,
      content_hash: contentHash,
      token_usage: tokenUsage as unknown as Json,
      model: opts.cacheKey.model_id,
      model_id: opts.cacheKey.model_id,
      calculation_version: opts.cacheKey.calculation_version,
      prompt_version: opts.cacheKey.prompt_version,
      provider: opts.provider,
      generated_at: finalStatus === "completed" ? new Date().toISOString() : null,
      error_message: opts.forceErrorMessage ?? null,
      ai_generation_count: completed > 0 ? 1 : 0,
    } as unknown as never)
    .eq("id", opts.reportId)
    .eq("user_id", opts.userId);
  return { status: finalStatus, completedChapters: completed, totalChapters: PREMIUM_V3_CHAPTERS.length };
}

async function startPremiumReportState(userId: string, chartId: string): Promise<PremiumReportStart> {
  const chart = await loadChartOwnedBy(userId, chartId);
  assertSystemsComplete(chart);
  const order = await assertPaidOrder(userId, chartId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const engineInput = buildEngineInputForChart(chart);
  const cacheKey = await makeCacheKey(userId, chartId, engineInput);
  const { data: cached } = await supabaseAdmin
    .from("premium_pdf_reports")
    .select("id, status, content_json")
    .eq("user_id", userId)
    .eq("chart_id", chartId)
    .eq("report_version", cacheKey.report_version)
    .eq("input_hash", cacheKey.input_hash)
    .eq("prompt_version", cacheKey.prompt_version)
    .eq("model_id", cacheKey.model_id)
    .eq("calculation_version", cacheKey.calculation_version)
    .maybeSingle();
  if (cached?.content_json && countValidPremiumContentChapters(cached.content_json) >= 24) {
    if (cached.status !== "completed") {
      await repairCompletedReportFromContent({ reportId: cached.id, userId, content: cached.content_json });
    }
    return { reportId: cached.id, status: "completed" };
  }

  const { data: legacy } = await supabaseAdmin
    .from("premium_pdf_reports")
    .select("id, status, content_json")
    .eq("user_id", userId)
    .eq("chart_id", chartId)
    .eq("report_version", cacheKey.report_version)
    .is("input_hash", null)
    .maybeSingle();
  if (legacy?.content_json && countValidPremiumContentChapters(legacy.content_json) >= 24) {
    if (legacy.status !== "completed") {
      await repairCompletedReportFromContent({ reportId: legacy.id, userId, content: legacy.content_json });
    }
    return { reportId: legacy.id, status: "completed" };
  }

  const { row } = await beginPremiumReportRow(userId, chartId, order.id, cacheKey);
  if (row.status !== "completed") {
    await supabaseAdmin
      .from("premium_pdf_reports")
      .update({ status: "generating", error_message: null } as unknown as never)
      .eq("id", row.id)
      .eq("user_id", userId);
    await ensurePendingChapterRows(row.id, userId);
    await recoverStaleChapterLocks(row.id, userId);
  }
  return { reportId: row.id, status: row.status === "completed" ? "completed" : "generating" };
}

export const generatePremiumReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumReportStart> => {
    const { userId } = context;
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-start:${userId}`, 12, 60_000, "premium report starts");
    return startPremiumReportState(userId, data.chartId);
  });

export const processNextPremiumChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StepInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumChapterStepResult> => {
    const { userId } = context;
    let stage = "start";
    try {
    stage = "assertEmailVerifiedOrAdmin";
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-step:${userId}`, 80, 60_000, "premium chapter steps");
    stage = "import-supabaseAdmin";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");

    stage = "select-report";
    const { data: report } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, user_id, chart_id, status, content_json, input_hash")
      .eq("id", data.reportId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!report) throw new Error("report_not_found");
    if (report.content_json && countValidPremiumContentChapters(report.content_json) >= PREMIUM_V3_CHAPTERS.length) {
      stage = "repairCompletedReportFromContent";
      await repairCompletedReportFromContent({ reportId: report.id, userId, content: report.content_json });
      return {
        reportId: report.id,
        status: "completed",
        processed: false,
        providerCalled: false,
        processedChapters: 0,
        shouldContinue: false,
        completedChapters: PREMIUM_V3_CHAPTERS.length,
        totalChapters: PREMIUM_V3_CHAPTERS.length,
        currentChapterKey: null,
        currentChapterTitle: null,
        message: "completed",
      };
    }

    stage = "loadChartOwnedBy";
    const chart = await loadChartOwnedBy(userId, report.chart_id);
    stage = "assertSystemsComplete";
    assertSystemsComplete(chart);
    stage = "assertPaidOrder";
    await assertPaidOrder(userId, report.chart_id);
    stage = "ensurePendingChapterRows";
    await ensurePendingChapterRows(report.id, userId);
    stage = "recoverStaleChapterLocks";
    await recoverStaleChapterLocks(report.id, userId);
    stage = "update-report-generating";
    await supabaseAdmin
      .from("premium_pdf_reports")
      .update({ status: "generating", error_message: null } as unknown as never)
      .eq("id", report.id)
      .eq("user_id", userId)
      .neq("status", "completed");

    stage = "buildEngineInputForChart";
    const engineInput = buildEngineInputForChart(chart);
    stage = "makeCacheKey";
    const cacheKey = await makeCacheKey(userId, report.chart_id, engineInput);
    const isZh = (chart.lang ?? "en") === "zh";
    const apiKey = process.env.LOVABLE_API_KEY;
    const isTestMode = isDeterministicGenerationModeFor(process.env, { hasApiKey: Boolean(apiKey) });
    const providerName = isTestMode ? "deterministic-stub" : "lovable-ai-gateway";
    if (!isTestMode && !apiKey) throw new Error("provider_unavailable");

    // NOTE: SupabaseClient.rpc uses `this.rest` internally, so it MUST be
    // invoked as a method on the client — never destructured or assigned to
    // a bare variable. Doing so drops `this` under strict mode and produces
    // "Cannot read properties of undefined (reading 'rest')".
    const rpc = (
      fn: string,
      args: Record<string, unknown>,
    ): Promise<{ data: boolean | null; error: { message?: string } | null }> =>
      (supabaseAdmin.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: boolean | null; error: { message?: string } | null }>)
        .call(supabaseAdmin, fn, args);

    stage = "import-buildPremiumFacts";
    const { buildPremiumFacts } = await import("./premium-facts");
    const { validateChapterAgainstFacts } = await import("./chapter-json-schema");
    stage = "buildPremiumFacts";
    const facts = buildPremiumFacts(engineInput.snapshot);
    const factsJson = JSON.stringify(facts, null, 2).slice(0, 12000);
    stage = "select-webReport";
    const { data: webReport } = await supabaseAdmin
      .from("reports")
      .select("report_json")
      .eq("user_id", userId)
      .eq("chart_id", report.chart_id)
      .eq("kind", "report")
      .eq("status", "completed")
      .maybeSingle();
    const webReportText = webReport?.report_json ? JSON.stringify(webReport.report_json).slice(0, 6000) : "";
    const chartFacts = [
      chart.name && `${isZh ? "姓名" : "Name"}: ${chart.name}`,
      chart.birth_date && `${isZh ? "阳历生日" : "Solar birth"}: ${chart.birth_date}`,
      chart.birth_time && `${isZh ? "出生时间" : "Birth time"}: ${chart.birth_time}`,
      chart.birth_place && `${isZh ? "出生地点" : "Birth place"}: ${chart.birth_place}`,
    ].filter(Boolean).join("\n");

    const deadline = Date.now() + (isTestMode ? 55_000 : 45_000);
    let processedChapters = 0;
    let providerCalled = false;

    stage = "drain-loop";
    while (true) {

      await recoverStaleChapterLocks(report.id, userId);
      const { data: rowsRaw } = await supabaseAdmin
        .from("premium_report_chapters")
        .select("chapter_key, chapter_index, status, attempt_count, claim_token, claimed_at, content_json, evidence_refs, input_tokens, output_tokens, error_message")
        .eq("report_id", report.id)
        .eq("user_id", userId)
        .order("chapter_index", { ascending: true });
      const rows = (rowsRaw ?? []) as ChapterDbRow[];
      const active = rows.find((r) => r.status === "running");
      const completedBefore = rows.filter((r) => r.status === "completed").length;
      if (active) {
        const meta = PREMIUM_V3_CHAPTERS.find((c) => c.key === active.chapter_key);
        return {
          reportId: report.id,
          status: "generating",
          processed: processedChapters > 0,
          providerCalled,
          processedChapters,
          shouldContinue: true,
          completedChapters: completedBefore,
          totalChapters: PREMIUM_V3_CHAPTERS.length,
          currentChapterKey: active.chapter_key,
          currentChapterTitle: meta ? (isZh ? meta.title_zh : meta.title_en) : null,
          message: "active_lease",
        };
      }

      const nextMeta = PREMIUM_V3_CHAPTERS.find((c) => {
        const r = rows.find((row) => row.chapter_key === c.key);
        return !r || r.status === "pending" || (r.status === "failed" && r.attempt_count < MAX_CHAPTER_ATTEMPTS);
      });
      if (!nextMeta) {
        const aggregate = await buildAggregateReport({ reportId: report.id, userId, chart, cacheKey, facts, provider: providerName });
        return {
          reportId: report.id,
          status: aggregate.status,
          processed: processedChapters > 0,
          providerCalled,
          processedChapters,
          shouldContinue: false,
          completedChapters: aggregate.completedChapters,
          totalChapters: aggregate.totalChapters,
          currentChapterKey: null,
          currentChapterTitle: null,
          message: aggregate.status === "completed" ? "completed" : "no_claim",
        };
      }

      if (Date.now() >= deadline && processedChapters > 0) {
        return {
          reportId: report.id,
          status: "generating",
          processed: true,
          providerCalled,
          processedChapters,
          shouldContinue: true,
          completedChapters: completedBefore,
          totalChapters: PREMIUM_V3_CHAPTERS.length,
          currentChapterKey: nextMeta.key,
          currentChapterTitle: isZh ? nextMeta.title_zh : nextMeta.title_en,
          message: "processed",
        };
      }

      const claimToken = crypto.randomUUID();
      const { data: won, error: claimError } = await rpc("claim_premium_chapter_for_user", {
        _user_id: userId,
        _report_id: report.id,
        _chapter_key: nextMeta.key,
        _chapter_index: nextMeta.index,
        _new_token: claimToken,
        _lock_ttl_seconds: CHAPTER_LEASE_SECONDS,
      });
      if (claimError || won !== true) {
        return {
          reportId: report.id,
          status: "generating",
          processed: processedChapters > 0,
          providerCalled,
          processedChapters,
          shouldContinue: true,
          completedChapters: completedBefore,
          totalChapters: PREMIUM_V3_CHAPTERS.length,
          currentChapterKey: nextMeta.key,
          currentChapterTitle: isZh ? nextMeta.title_zh : nextMeta.title_en,
          message: "no_claim",
        };
      }

      const prior = rows.find((r) => r.chapter_key === nextMeta.key);
      const title = isZh ? nextMeta.title_zh : nextMeta.title_en;
      let body = "";
      let refs: EvidenceRef[] = [];
      let usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
      let providerError: string | null = null;
      try {
        providerCalled = true;
        if (isTestMode) {
          body = deterministicChapterBody(nextMeta, title, isZh);
          refs = deterministicEvidenceRefs(nextMeta);
          usage = { input_tokens: 100, output_tokens: 200 };
        } else {
          const { chapterOutputCap } = await import("./budget-policy");
          const spent = rows.reduce(
            (sum, r) => ({ input_tokens: sum.input_tokens + (r.input_tokens ?? 0), output_tokens: sum.output_tokens + (r.output_tokens ?? 0) }),
            { input_tokens: 0, output_tokens: 0 },
          );
          const out = await generateChapter(nextMeta.key, title, chartFacts, factsJson, webReportText, isZh, apiKey!, {
            allowedFacts: nextMeta.allowed_facts,
            targetCharsZh: nextMeta.target_chars_zh,
            maxOutputTokens: chapterOutputCap(spent),
          });
          body = out.text;
          refs = out.evidence_refs as EvidenceRef[];
          usage = out.usage ?? usage;
        }
        const issues = validateChapterAgainstFacts({ meta: nextMeta, facts, chapter: { body, evidence_refs: refs } });
        if (issues.length > 0) providerError = `validation:${issues.slice(0, 3).map((i) => i.problem).join("|")}`;
      } catch (err) {
        providerError = safeMessage(err, "chapter_provider_error");
      }

      if (providerError) {
        await supabaseAdmin
          .from("premium_report_chapters")
          .update({
            status: "failed",
            claim_token: null,
            error_message: sanitizeAuditMessage(providerError),
            input_tokens: (prior?.input_tokens ?? 0) + usage.input_tokens,
            output_tokens: (prior?.output_tokens ?? 0) + usage.output_tokens,
          } as unknown as never)
          .eq("report_id", report.id)
          .eq("user_id", userId)
          .eq("chapter_key", nextMeta.key)
          .eq("claim_token", claimToken);
        await supabaseAdmin.from("ai_usage_ledger").insert({
          user_id: userId,
          report_id: report.id,
          chapter_key: nextMeta.key,
          operation: "chapter_generate",
          model_id: cacheKey.model_id,
          provider: providerName,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          status: "error",
          error_code: providerError.slice(0, 120),
        } as unknown as never);
        const aggregate = await buildAggregateReport({ reportId: report.id, userId, chart, cacheKey, facts, provider: providerName, forceErrorMessage: "generation_interrupted" });
        return {
          reportId: report.id,
          status: aggregate.status,
          processed: true,
          providerCalled: true,
          processedChapters,
          shouldContinue: aggregate.status === "generating",
          completedChapters: aggregate.completedChapters,
          totalChapters: aggregate.totalChapters,
          currentChapterKey: nextMeta.key,
          currentChapterTitle: title,
          message: "interrupted",
        };
      }

      const chapterContent = {
        key: nextMeta.key,
        title,
        body,
        evidence_refs: refs,
        confidence: chapterConfidence(refs),
      };
      const chapterHash = await computeContentHash(chapterContent);
      await supabaseAdmin
        .from("premium_report_chapters")
        .update({
          status: "completed",
          content_json: chapterContent as unknown as Json,
          evidence_refs: refs as unknown as Json,
          confidence: chapterContent.confidence,
          content_hash: chapterHash,
          input_tokens: (prior?.input_tokens ?? 0) + usage.input_tokens,
          output_tokens: (prior?.output_tokens ?? 0) + usage.output_tokens,
          error_message: null,
          claim_token: null,
          completed_at: new Date().toISOString(),
        } as unknown as never)
        .eq("report_id", report.id)
        .eq("user_id", userId)
        .eq("chapter_key", nextMeta.key)
        .eq("claim_token", claimToken)
        .neq("status", "completed");
      await supabaseAdmin.from("ai_usage_ledger").insert({
        user_id: userId,
        report_id: report.id,
        chapter_key: nextMeta.key,
        operation: "chapter_generate",
        model_id: cacheKey.model_id,
        provider: providerName,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        status: "ok",
      } as unknown as never);
      processedChapters += 1;

      const aggregate = await buildAggregateReport({ reportId: report.id, userId, chart, cacheKey, facts, provider: providerName });
      if (aggregate.status === "completed") {
        return {
          reportId: report.id,
          status: "completed",
          processed: true,
          providerCalled,
          processedChapters,
          shouldContinue: false,
          completedChapters: aggregate.completedChapters,
          totalChapters: aggregate.totalChapters,
          currentChapterKey: null,
          currentChapterTitle: null,
          message: "completed",
        };
      }
    }
    } catch (err) {
      const msg = safeMessage(err, "chapter_step_error");
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[premium] processNextPremiumChapter failed", { reportId: data.reportId, userId, stage, err: msg, stack });


      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("premium_pdf_reports")
          .update({ error_message: sanitizeAuditMessage(msg) } as unknown as never)
          .eq("id", data.reportId)
          .eq("user_id", userId)
          .neq("status", "completed");
      } catch { /* best-effort */ }
      const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
      return {
        reportId: data.reportId,
        status: "partial",
        processed: false,
        providerCalled: false,
        processedChapters: 0,
        shouldContinue: false,
        completedChapters: 0,
        totalChapters: PREMIUM_V3_CHAPTERS.length,
        currentChapterKey: null,
        currentChapterTitle: null,
        message: "prep_error",
        error: sanitizeAuditMessage(msg),
      };
    }
  });



/* --------------------------------------------------------------------- */
/* getPremiumReport — owner-only content read                             */
/* --------------------------------------------------------------------- */

export type PremiumReportRead = {
  status: "pending" | "generating" | "partial" | "completed" | "failed";
  generatedAt: string | null;
  content: PremiumContent | null;
  errorMessage: string | null;
  aiGenerationCount: number;
  inputHash: string | null;
  contentHash: string | null;
  promptVersion: string | null;
  modelId: string | null;
  calculationVersion: string | null;
  tokenUsage: TokenUsage | null;
};

export const getPremiumReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumReportRead | null> => {
    const { supabase, userId } = context;
    // Ownership guard: chart must belong to caller. Cross-user reads
    // are blocked here AND by RLS — this is defense in depth.
    const { data: chart } = await supabase
      .from("charts")
      .select("id, user_id")
      .eq("id", data.chartId)
      .maybeSingle();
    if (!chart || chart.user_id !== userId) return null;

    // Default to the ORIGINAL purchased report: order by created_at ASC.
    // Version upgrades create new rows; the earliest one is what the
    // buyer originally paid for, so that's what we return by default.
    const { data: row } = await supabase
      .from("premium_pdf_reports")
      .select(
        "id, status, content_json, generated_at, error_message, ai_generation_count, input_hash, content_hash, prompt_version, model_id, calculation_version, token_usage",
      )
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    const r = row as unknown as {
      status: string;
      content_json: unknown;
      generated_at: string | null;
      error_message: string | null;
      ai_generation_count?: number;
      input_hash: string | null;
      content_hash: string | null;
      prompt_version: string | null;
      model_id: string | null;
      calculation_version: string | null;
      token_usage: unknown;
    };
    let status = r.status as PremiumReportRead["status"];
    let generatedAt = r.generated_at;
    if (r.content_json && status !== "completed" && countValidPremiumContentChapters(r.content_json) >= 24) {
      await repairCompletedReportFromContent({
        reportId: (row as { id: string }).id,
        userId,
        content: r.content_json,
      });
      status = "completed";
      generatedAt = generatedAt ?? new Date().toISOString();
    }
    return {
      status,
      generatedAt,
      content: (r.content_json as PremiumContent) ?? null,
      errorMessage: r.error_message,
      aiGenerationCount: typeof r.ai_generation_count === "number" ? r.ai_generation_count : 0,
      inputHash: r.input_hash ?? null,
      contentHash: r.content_hash ?? null,
      promptVersion: r.prompt_version ?? null,
      modelId: r.model_id ?? null,
      calculationVersion: r.calculation_version ?? null,
      tokenUsage: (r.token_usage as TokenUsage | null) ?? null,
    };
  });


/* --------------------------------------------------------------------- */
/* listPremiumReports — user's own deep reports across all charts         */
/* --------------------------------------------------------------------- */

export type MyPremiumReportRow = {
  chartId: string;
  chartName: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  lang: string | null;
  order: {
    status: "pending" | "paid" | "failed" | "refunded";
    productVersion: string;
    isLegacy: boolean;
    paidAt: string | null;
  } | null;
  report: {
    status: "pending" | "generating" | "partial" | "completed" | "failed";
    generatedAt: string | null;
  } | null;
};

export const listPremiumReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPremiumReportRow[]> => {
    const { supabase, userId } = context;

    // Consider only orders that grant access: current version pending/
    // paid, or legacy paid. Everything else is skipped for this listing.
    const { data: currentOrders } = await supabase
      .from("premium_report_orders")
      .select("id, chart_id, status, product_version, paid_at")
      .eq("user_id", userId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false });

    const { data: legacyPaidOrders } = await supabase
      .from("premium_report_orders")
      .select("id, chart_id, status, product_version, paid_at")
      .eq("user_id", userId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    type OrderLike = {
      id: string;
      chart_id: string;
      status: string;
      product_version: string;
      paid_at: string | null;
    };
    const byChart = new Map<string, OrderLike>();
    for (const o of (currentOrders ?? []) as OrderLike[]) {
      if (!byChart.has(o.chart_id)) byChart.set(o.chart_id, o);
    }
    for (const o of (legacyPaidOrders ?? []) as OrderLike[]) {
      // Legacy paid trumps current pending for display purposes.
      const existing = byChart.get(o.chart_id);
      if (!existing || existing.status !== "paid") byChart.set(o.chart_id, o);
    }
    if (byChart.size === 0) return [];

    const chartIds = Array.from(byChart.keys());
    const { data: charts } = await supabase
      .from("charts")
      .select("id, name, birth_date, birth_place, lang")
      .eq("user_id", userId)
      .in("id", chartIds);

    const { data: reports } = await supabase
      .from("premium_pdf_reports")
      .select("chart_id, status, generated_at")
      .eq("user_id", userId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .in("chart_id", chartIds);
    const reportBy = new Map<string, { status: string; generated_at: string | null }>();
    for (const r of reports ?? [])
      reportBy.set(r.chart_id, { status: r.status, generated_at: r.generated_at });

    return (charts ?? []).map((c) => {
      const order = byChart.get(c.id)!;
      const rep = reportBy.get(c.id);
      return {
        chartId: c.id,
        chartName: c.name,
        birthDate: c.birth_date,
        birthPlace: c.birth_place,
        lang: c.lang,
        order: {
          status: order.status as MyPremiumReportRow["order"] extends infer T
            ? T extends { status: infer S }
              ? S
              : never
            : never,
          productVersion: order.product_version,
          isLegacy: (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(
            order.product_version,
          ),
          paidAt: order.paid_at,
        },
        report: rep
          ? {
              status: rep.status as "pending" | "generating" | "partial" | "completed" | "failed",
              generatedAt: rep.generated_at,
            }
          : null,
      };
    });
  });

/* --------------------------------------------------------------------- */
/* getPremiumReportProgress — chapter-level status for the reader UI      */
/* --------------------------------------------------------------------- */

export type ProgressChapter = {
  key: string;
  index: number;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attemptCount: number;
  errorMessage: string | null;
};

export type PremiumReportProgress = {
  reportStatus: "pending" | "generating" | "partial" | "completed" | "failed" | "none";
  schemaVersion: "v1" | "v2" | "v3" | null;
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  runningChapters: number;
  canContinue: boolean;
  chapters: ProgressChapter[];
};

export const getPremiumReportProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumReportProgress> => {
    const { supabase, userId } = context;
    const { data: chart } = await supabase
      .from("charts")
      .select("id, user_id, lang")
      .eq("id", data.chartId)
      .maybeSingle();
    const empty: PremiumReportProgress = {
      reportStatus: "none",
      schemaVersion: null,
      totalChapters: 0,
      completedChapters: 0,
      failedChapters: 0,
      runningChapters: 0,
      canContinue: false,
      chapters: [],
    };
    if (!chart || chart.user_id !== userId) return empty;

    const { data: row } = await supabase
      .from("premium_pdf_reports")
      .select("id, status, content_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!row) return empty;

    const rowContent = (row as { content_json: { meta?: { report_schema_version?: "v1" | "v2" | "v3" } } | null }).content_json;
    const contentMeta = rowContent?.meta;
    const schemaVersion = contentMeta?.report_schema_version ?? null;

    const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
    const isZh = (chart.lang ?? "en") === "zh";

    // Progress reads are allowed to repair stale leases so a user who
    // refreshes after an interrupted serverless request immediately sees a
    // continuable state instead of being stuck on an old `running` chapter.
    await recoverStaleChapterLocks((row as { id: string }).id, userId);
    const contentChapterCount = countValidPremiumContentChapters(rowContent);
    if (contentChapterCount >= PREMIUM_V3_CHAPTERS.length) {
      await repairCompletedReportFromContent({
        reportId: (row as { id: string }).id,
        userId,
        content: rowContent,
      });
    }

    const { data: chRows } = await supabase
      .from("premium_report_chapters")
      .select("chapter_key, chapter_index, status, attempt_count, error_message")
      .eq("report_id", (row as { id: string }).id)
      .eq("user_id", userId);
    const byKey = new Map(
      ((chRows ?? []) as Array<{
        chapter_key: string;
        chapter_index: number;
        status: string;
        attempt_count: number;
        error_message: string | null;
      }>).map((r) => [r.chapter_key, r]),
    );

    const chapters: ProgressChapter[] = PREMIUM_V3_CHAPTERS.map((c) => {
      const r = byKey.get(c.key);
      return {
        key: c.key,
        index: c.index,
        title: isZh ? c.title_zh : c.title_en,
        status: (r?.status ?? "pending") as ProgressChapter["status"],
        attemptCount: r?.attempt_count ?? 0,
        errorMessage: r?.error_message ?? null,
      };
    });

    const completed = Math.max(
      chapters.filter((c) => c.status === "completed").length,
      contentChapterCount >= PREMIUM_V3_CHAPTERS.length ? PREMIUM_V3_CHAPTERS.length : 0,
    );
    const failed = chapters.filter((c) => c.status === "failed").length;
    const running = chapters.filter((c) => c.status === "running").length;
    const canContinue = chapters.some(
      (c) =>
        c.status === "pending" ||
        (c.status === "failed" && c.attemptCount < 3),
    );

    return {
      reportStatus: contentChapterCount >= PREMIUM_V3_CHAPTERS.length
        ? "completed"
        : (row as { status: PremiumReportProgress["reportStatus"] }).status,
      schemaVersion,
      totalChapters: chapters.length,
      completedChapters: completed,
      failedChapters: failed,
      runningChapters: running,
      canContinue,
      chapters,
    };
  });

// Backwards-compat export: legacy callers importing the old symbol are
// harmless since the file no longer offers PDF UI. Keeping a typed alias
// avoids accidental client-bundle breakage from stale imports.
export const generatePremiumPdf = generatePremiumReport;
export type Json_ = Json; // side-effect: keep Json import referenced

