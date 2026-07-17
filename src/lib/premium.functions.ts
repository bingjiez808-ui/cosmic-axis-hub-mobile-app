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
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import { isEmailVerified, assertEmailVerifiedOrAdmin } from "./reports-store.functions";
import { buildCalculationSnapshot, missingSystems, type CalculationSnapshot } from "./calc-snapshot";
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
      .select("id, status, generated_at, error_message")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

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
      report: reportRow
        ? {
            id: reportRow.id,
            status: reportRow.status as "pending" | "generating" | "partial" | "completed" | "failed",
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

export type PremiumChapter = { key: string; title: string; body: string };
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
  opts: { allowedFacts?: readonly string[]; targetCharsZh?: readonly [number, number]; maxOutputTokens?: number } = {},
): Promise<{ text: string; usage: TokenUsage | null }> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const guardrails = guardrailsFor(isZh ? "zh" : "en");
  const allowedHint = opts.allowedFacts && opts.allowedFacts.length > 0
    ? (isZh ? `本章仅可引用事实模块：${opts.allowedFacts.join("、")}。` : `Only cite fact modules: ${opts.allowedFacts.join(", ")}.`)
    : (isZh ? "本章不引用命盘事实模块。" : "This chapter does not cite chart facts.");
  const lenHint = opts.targetCharsZh
    ? (isZh ? `目标字数：${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} 汉字。` : `Target length: ${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} Chinese characters (or equivalent).`)
    : "";
  const system = isZh
    ? `你是命运图书馆资深占星与命理长者。撰写一份高级 AI 深度报告的一个章节，只在站内网页中阅读。

事实纪律（不可违反）：
- 你只能引用下面 FACTS JSON 中真实存在的字段。
- FACTS.unavailable 里列出的模块本地尚未计算，禁止编造；如需提到，只能诚实说明"暂未提供"。
- 跨体系结论至少援引两个不同体系的事实；矛盾要展示，不强行统一。
- 不给医疗诊断、灾祸预言或收益保证；用"倾向 / 窗口 / 可能"等谨慎措辞。
- 输出纯文本段落，不要 Markdown 标题或代码块。段落之间用一个空行分隔。
${allowedHint}
${lenHint}
${guardrails}`
    : `You are a senior elder of the Library of Destiny writing one chapter of a premium deep reading delivered inside the web app.

Fact discipline (non-negotiable):
- You may only cite fields that actually appear in the FACTS JSON below.
- Modules listed in FACTS.unavailable are NOT computed locally — do not fabricate.
- Any cross-tradition conclusion must be backed by facts from at least two different traditions.
- No medical diagnoses, guaranteed misfortune, or financial promises.
- Output plain-text paragraphs (no Markdown headers or code fences). Separate paragraphs with one blank line.
${allowedHint}
${lenHint}
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
  const u = (result as unknown as { usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number } }).usage;
  const usage: TokenUsage | null = u
    ? {
        input_tokens: u.inputTokens ?? u.promptTokens ?? 0,
        output_tokens: u.outputTokens ?? u.completionTokens ?? 0,
      }
    : null;
  return { text: result.text.trim().slice(0, 12000), usage };
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
  return buildEngineInput(chartFacts, stableSnapshot, DEFAULT_VERSIONS);
}

export const generatePremiumReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims, supabase } = context;
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-generate:${userId}`, 3, 60_000, "premium report generations");

    // 1. Chart must belong to this user + all systems complete.
    const chart = await loadChartOwnedBy(userId, data.chartId);
    assertSystemsComplete(chart);

    // 2. Some paid entitlement must exist (current or legacy).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status, product_version")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_ALL_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) throw new Error("order_not_paid");

    // 3. Compute the versioned cache key from the local calc snapshot.
    //    Cache lookup checks all four version pins + input_hash + owner
    //    + chart; a hit short-circuits and NEVER calls the provider.
    const engineInput = buildEngineInputForChart(chart);
    const cacheKey = await makeCacheKey(userId, data.chartId, engineInput);

    const { data: cached } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, status, content_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", cacheKey.report_version)
      .eq("input_hash", cacheKey.input_hash)
      .eq("prompt_version", cacheKey.prompt_version)
      .eq("model_id", cacheKey.model_id)
      .eq("calculation_version", cacheKey.calculation_version)
      .maybeSingle();
    if (cached?.status === "completed" && cached.content_json) {
      return { reportId: cached.id, status: "completed" as const };
    }

    // Backwards-compat: legacy row without input_hash for this
    // (user, chart, report_version). Return it as-is; never overwrite.
    const { data: legacy } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, status, content_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", cacheKey.report_version)
      .is("input_hash", null)
      .maybeSingle();
    if (legacy?.status === "completed" && legacy.content_json) {
      return { reportId: legacy.id, status: "completed" as const };
    }

    // 4. Atomic claim (unique index on user_id, chart_id, report_version, input_hash).
    const { row, didStart } = await beginPremiumReportRow(
      userId,
      data.chartId,
      order.id,
      cacheKey,
    );
    // Whether we won the initial insert or attached to an existing row,
    // we may still need to RESUME chapter work when the row was left
    // in "generating" / "failed" from a previous invocation. Only a
    // fully "completed" row short-circuits without provider calls.
    if (!didStart && row.status === "completed" && row.content_json) {
      return { reportId: row.id, status: "completed" as const };
    }

    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      const isZh = (chart.lang ?? "en") === "zh";

      const { data: webReport } = await supabaseAdmin
        .from("reports")
        .select("report_json")
        .eq("user_id", userId)
        .eq("chart_id", data.chartId)
        .eq("kind", "report")
        .eq("status", "completed")
        .maybeSingle();
      const webReportText = webReport?.report_json
        ? JSON.stringify(webReport.report_json).slice(0, 6000)
        : "";

      const chartFacts = [
        chart.name && `${isZh ? "姓名" : "Name"}: ${chart.name}`,
        chart.birth_date && `${isZh ? "阳历生日" : "Solar birth"}: ${chart.birth_date}`,
        chart.birth_time && `${isZh ? "出生时间" : "Birth time"}: ${chart.birth_time}`,
        chart.birth_place && `${isZh ? "出生地点" : "Birth place"}: ${chart.birth_place}`,
      ]
        .filter(Boolean)
        .join("\n");

      // Local immutable facts derived from the same snapshot used by the
      // cache key. This is the ONLY chart data the AI is allowed to cite.
      const { buildPremiumFacts } = await import("./premium-facts");
      const facts = buildPremiumFacts(engineInput.snapshot);
      const factsJson = JSON.stringify(facts, null, 2).slice(0, 12000);

      // v3 24-chapter catalogue.
      const { PREMIUM_V3_CHAPTERS } = await import("./premium-chapters-v3");
      const { runChapterWorkers } = await import("./chapter-worker");
      const { AI_BUDGET_POLICY, chapterOutputCap } = await import("./budget-policy");

      // Load existing per-chapter rows for this report — resume basis.
      const { data: existingChapters } = await supabaseAdmin
        .from("premium_report_chapters")
        .select("chapter_key, chapter_index, status, attempt_count, claim_token, content_json, input_tokens, output_tokens")
        .eq("report_id", row.id)
        .eq("user_id", userId);
      type ChRow = {
        chapter_key: string; chapter_index: number; status: string;
        attempt_count: number; claim_token: string | null;
        content_json: unknown; input_tokens: number; output_tokens: number;
      };
      const existing = (existingChapters ?? []) as ChRow[];
      const existingByKey = new Map(existing.map((c) => [c.chapter_key, c]));

      // Aggregate budget already spent on prior attempts.
      const priorUsage = existing.reduce(
        (a, c) => ({
          input_tokens: a.input_tokens + (c.input_tokens ?? 0),
          output_tokens: a.output_tokens + (c.output_tokens ?? 0),
        }),
        { input_tokens: 0, output_tokens: 0 },
      );

      const catalogue = PREMIUM_V3_CHAPTERS.map((c) => ({ key: c.key, index: c.index }));
      const rowsForWorker = catalogue.map((c) => {
        const e = existingByKey.get(c.key);
        return {
          chapter_key: c.key,
          chapter_index: c.index,
          status: (e?.status ?? "pending") as "pending" | "running" | "completed" | "failed" | "skipped",
          attempt_count: e?.attempt_count ?? 0,
          claim_token: e?.claim_token ?? null,
        };
      });

      const isTestMode = process.env.PREMIUM_TEST_DETERMINISTIC === "1" || !apiKey;

      // Preflight atomic claim: for every chapter still eligible to run
      // (pending / retriable failed), attempt a CAS claim through the
      // security-definer `claim_premium_chapter` RPC. Only chapters the
      // caller wins the claim on are handed to the worker; the rest are
      // considered held by another worker and left untouched.
      const claimedKeys = new Set<string>();
      for (const c of catalogue) {
        const e = existingByKey.get(c.key);
        const status = e?.status ?? "pending";
        if (status === "completed" || status === "skipped") continue;
        if (status === "failed" && (e?.attempt_count ?? 0) >= 3) continue;
        const newToken = crypto.randomUUID();
        try {
          const { data: won } = await (supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: boolean | null; error: unknown }>)(
            "claim_premium_chapter",
            {
              _report_id: row.id,
              _chapter_key: c.key,
              _chapter_index: c.index,
              _new_token: newToken,
              _lock_ttl_seconds: 300,
            },
          );
          if (won === true) claimedKeys.add(c.key);
        } catch {
          // Claim failed — leave the chapter for a future run.
        }
      }
      const claimedCatalog = catalogue.filter((c) => claimedKeys.has(c.key));


      const provider = async (
        meta: { key: string; index: number },
        outputCap: number,
      ) => {
        const catalog = PREMIUM_V3_CHAPTERS.find((c) => c.key === meta.key)!;
        const title = isZh ? catalog.title_zh : catalog.title_en;
        if (isTestMode) {
          const body = `[${title}] deterministic stub — ${catalog.allowed_facts.join(",") || "no-facts"}`;
          return {
            ok: true as const,
            body,
            usage: { input_tokens: 100, output_tokens: 200 },
          };
        }
        try {
          const out = await generateChapter(
            meta.key,
            title,
            chartFacts,
            factsJson,
            webReportText,
            isZh,
            apiKey!,
            {
              allowedFacts: catalog.allowed_facts,
              targetCharsZh: catalog.target_chars_zh,
              maxOutputTokens: outputCap,
            },
          );
          return {
            ok: true as const,
            body: out.text,
            usage: out.usage ?? { input_tokens: 0, output_tokens: 0 },
          };
        } catch (err) {
          return {
            ok: false as const,
            error: safeMessage(err, "chapter_provider_error"),
          };
        }
      };
      void chapterOutputCap;

      const workerReport = await runChapterWorkers({
        catalog: claimedCatalog,
        rows: rowsForWorker,
        provider,
        initialUsage: priorUsage,
      });


      // Persist chapter transitions + ledger entries.
      for (const t of workerReport.transitions) {
        const catalog = PREMIUM_V3_CHAPTERS.find((c) => c.key === t.chapter_key)!;
        const prior = existingByKey.get(t.chapter_key);
        if (t.kind === "completed") {
          const upsert = {
            report_id: row.id,
            user_id: userId,
            chapter_key: t.chapter_key,
            chapter_index: catalog.index,
            status: "completed",
            attempt_count: (prior?.attempt_count ?? 0) + 1,
            content_json: { key: t.chapter_key, title: isZh ? catalog.title_zh : catalog.title_en, body: t.body, evidence_refs: [] } as unknown as Json,
            evidence_refs: [] as unknown as Json,
            input_tokens: (prior?.input_tokens ?? 0) + t.input_tokens,
            output_tokens: (prior?.output_tokens ?? 0) + t.output_tokens,
            error_message: null,
            claim_token: null,
            completed_at: new Date().toISOString(),
          };
          await supabaseAdmin
            .from("premium_report_chapters")
            .upsert(upsert as unknown as never, { onConflict: "report_id,chapter_key" });
          await supabaseAdmin.from("ai_usage_ledger").insert({
            user_id: userId,
            report_id: row.id,
            chapter_key: t.chapter_key,
            operation: "chapter_generate",
            model_id: cacheKey.model_id,
            provider: isTestMode ? "deterministic-stub" : "lovable-ai-gateway",
            input_tokens: t.input_tokens,
            output_tokens: t.output_tokens,
            status: "ok",
          } as unknown as never);
        } else if (t.kind === "failed") {
          await supabaseAdmin
            .from("premium_report_chapters")
            .upsert({
              report_id: row.id,
              user_id: userId,
              chapter_key: t.chapter_key,
              chapter_index: catalog.index,
              status: "failed",
              attempt_count: (prior?.attempt_count ?? 0) + 1,
              error_message: t.error.slice(0, 400),
              input_tokens: (prior?.input_tokens ?? 0) + t.input_tokens,
              output_tokens: (prior?.output_tokens ?? 0) + t.output_tokens,
            } as unknown as never, { onConflict: "report_id,chapter_key" });
          await supabaseAdmin.from("ai_usage_ledger").insert({
            user_id: userId,
            report_id: row.id,
            chapter_key: t.chapter_key,
            operation: "chapter_generate",
            model_id: cacheKey.model_id,
            provider: isTestMode ? "deterministic-stub" : "lovable-ai-gateway",
            input_tokens: t.input_tokens,
            output_tokens: t.output_tokens,
            status: "error",
            error_code: t.error.slice(0, 120),
          } as unknown as never);
        } else if (t.kind === "skipped_budget") {
          await supabaseAdmin.from("ai_usage_ledger").insert({
            user_id: userId,
            report_id: row.id,
            chapter_key: t.chapter_key,
            operation: "chapter_generate",
            model_id: cacheKey.model_id,
            provider: isTestMode ? "deterministic-stub" : "lovable-ai-gateway",
            input_tokens: 0,
            output_tokens: 0,
            status: "budget_stopped",
            error_code: t.reason,
          } as unknown as never);
        }
      }

      // Re-fetch chapter rows to build content_json from the full picture.
      const { data: allChapters } = await supabaseAdmin
        .from("premium_report_chapters")
        .select("chapter_key, chapter_index, status, content_json")
        .eq("report_id", row.id)
        .eq("user_id", userId)
        .order("chapter_index", { ascending: true });
      const chapterList: PremiumChapter[] = [];
      for (const c of PREMIUM_V3_CHAPTERS) {
        const rec = (allChapters ?? []).find((x) => x.chapter_key === c.key) as
          | { chapter_key: string; status: string; content_json: unknown }
          | undefined;
        const title = isZh ? c.title_zh : c.title_en;
        if (rec?.status === "completed" && rec.content_json) {
          const cj = rec.content_json as { body?: string };
          chapterList.push({ key: c.key, title, body: cj.body ?? "" });
        } else {
          chapterList.push({
            key: c.key,
            title,
            body: isZh
              ? "本章尚未生成或暂时不可用，稍后可继续生成。"
              : "This chapter has not been generated yet. It can be resumed later.",
          });
        }
      }

      const completedCount = (allChapters ?? []).filter((c) => c.status === "completed").length;
      const totalTarget = PREMIUM_V3_CHAPTERS.length;
      const budgetStopped =
        workerReport.stopped_reason === "report_input_exhausted" ||
        workerReport.stopped_reason === "report_output_exhausted";
      const finalStatus: "completed" | "partial" | "generating" =
        completedCount >= totalTarget
          ? "completed"
          : budgetStopped
            ? "partial"
            : completedCount > 0
              ? "partial"
              : "generating";

      const content: PremiumContent = {
        meta: {
          prompt_version: cacheKey.prompt_version,
          report_version: cacheKey.report_version,
          report_schema_version: PREMIUM_REPORT_SCHEMA_VERSION,
          generated_at: new Date().toISOString(),
          lang: isZh ? "zh" : "en",
          chart_name: chart.name ?? null,
          disclaimer: isZh ? DISCLAIMER_ZH : DISCLAIMER_EN,
        },
        cover: {
          title: isZh ? "命运图书馆 · 高级 AI 深度报告" : "Library of Destiny — Premium Deep Reading",
          subtitle: chart.name ?? (isZh ? "私人命盘解读" : "Personal chart reading"),
        },
        facts,
        chapters: chapterList,
      };
      const contentHash = await computeContentHash(content);
      const tokenUsage: TokenUsage = {
        input_tokens: priorUsage.input_tokens + workerReport.usage.input_tokens - priorUsage.input_tokens,
        output_tokens: priorUsage.output_tokens + workerReport.usage.output_tokens - priorUsage.output_tokens,
      };
      // workerReport.usage already includes priorUsage as initialUsage,
      // so the final ledger sums match ai_usage_ledger.
      void AI_BUDGET_POLICY;

      await supabaseAdmin
        .from("premium_pdf_reports")
        .update({
          status: finalStatus,
          content_json: content as unknown as never,
          content_hash: contentHash,
          token_usage: (tokenUsage as unknown as Json) ?? null,
          model: cacheKey.model_id,
          model_id: cacheKey.model_id,
          calculation_version: cacheKey.calculation_version,
          prompt_version: cacheKey.prompt_version,
          provider: isTestMode ? "deterministic-stub" : "lovable-ai-gateway",
          generated_at: new Date().toISOString(),
          error_message: budgetStopped ? `budget_stopped:${workerReport.stopped_reason}` : null,
          ai_generation_count: (existing.length > 0 ? undefined : 1),
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      return { reportId: row.id, status: finalStatus };
    } catch (err) {
      await supabaseAdmin
        .from("premium_pdf_reports")
        .update({
          status: "failed",
          error_message: safeMessage(err, "premium_generation_failed").slice(0, 400),
        })
        .eq("id", row.id)
        .eq("user_id", userId);
      throw new Error(safeMessage(err, "premium_generation_failed"));
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
        "status, content_json, generated_at, error_message, ai_generation_count, input_hash, content_hash, prompt_version, model_id, calculation_version, token_usage",
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
    return {
      status: r.status as PremiumReportRead["status"],
      generatedAt: r.generated_at,
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

// Backwards-compat export: legacy callers importing the old symbol are
// harmless since the file no longer offers PDF UI. Keeping a typed alias
// avoids accidental client-bundle breakage from stale imports.
export const generatePremiumPdf = generatePremiumReport;
export type Json_ = Json; // side-effect: keep Json import referenced
