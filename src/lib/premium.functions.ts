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
export const PREMIUM_PROMPT_VERSION = "v1";
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
    status: "pending" | "generating" | "completed" | "failed";
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
            status: reportRow.status as "pending" | "generating" | "completed" | "failed",
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
    await loadChartOwnedBy(userId, data.chartId);

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
  reportStatus: "pending" | "generating" | "completed" | "failed" | null;
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
    generated_at: string;
    lang: "en" | "zh";
    chart_name: string | null;
    disclaimer: string;
  };
  cover: { title: string; subtitle: string };
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
  key: (typeof CHAPTER_KEYS)[number],
  title: string,
  chartFacts: string,
  webReport: string,
  isZh: boolean,
  apiKey: string,
): Promise<string> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const guardrails = guardrailsFor(isZh ? "zh" : "en");
  const system = isZh
    ? `你是命运图书馆资深占星与命理长者。撰写一份高级 AI 深度报告的一个章节，只在站内网页中阅读。
- 只使用来访者的真实命盘事实与已有网页报告作为依据；不使用另一个人的模板。
- 不给医疗诊断、灾祸预言或收益保证；用「倾向 / 窗口 / 可能」等谨慎措辞。
- 输出纯文本段落，不要 Markdown 标题或代码块。段落之间用一个空行分隔。
- 长度约 500-900 汉字。
${guardrails}`
    : `You are a senior elder of the Library of Destiny writing one chapter of a premium deep reading delivered inside the web app.
- Anchor every claim in the visitor's real chart facts and the existing web report; never generic templates.
- No medical diagnoses, no guaranteed misfortune, no financial promises — use "tendency / window / possible".
- Output plain-text paragraphs (no Markdown headers or code fences). Separate paragraphs with one blank line.
- Length ~ 400-700 words.
${guardrails}`;

  const prompt = `${isZh ? "章节" : "Chapter"}: ${title} (${key})

${isZh ? "来访者命盘事实" : "Chart facts"}:
${chartFacts || (isZh ? "（未提供）" : "(not provided)")}

${isZh ? "现有网页报告摘要（可参考不要复述）" : "Existing web report (reference, do not copy verbatim)"}:
${webReport.slice(0, 4000)}
`;

  const { text } = await generateText({
    model: gateway("google/gemini-2.5-flash"),
    system,
    prompt,
  });
  return text.trim().slice(0, 8000);
}

async function beginPremiumReportRow(userId: string, chartId: string, orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inserted, error } = await supabaseAdmin
    .from("premium_pdf_reports")
    .insert({
      user_id: userId,
      chart_id: chartId,
      order_id: orderId,
      report_version: PREMIUM_REPORT_VERSION,
      prompt_version: PREMIUM_PROMPT_VERSION,
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
    .eq("report_version", PREMIUM_REPORT_VERSION)
    .maybeSingle();
  if (!existing) throw new Error("premium_row_lookup_failed");
  return { row: existing, didStart: false };
}

export const generatePremiumReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    await assertEmailVerifiedOrAdmin(context);
    enforceRateLimit(`premium-generate:${userId}`, 3, 60_000, "premium report generations");

    // 1. Chart must belong to this user.
    const chart = await loadChartOwnedBy(userId, data.chartId);

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

    // 3. Cached completed row → return as-is, do NOT call AI again.
    const { data: existing } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, status, content_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .maybeSingle();
    if (existing?.status === "completed" && existing.content_json) {
      return { reportId: existing.id, status: "completed" as const };
    }

    // 4. Atomic claim (unique index on user_id, chart_id, report_version).
    const { row, didStart } = await beginPremiumReportRow(userId, data.chartId, order.id);
    if (!didStart) {
      return {
        reportId: row.id,
        status: row.status as "pending" | "generating" | "completed" | "failed",
      };
    }

    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("ai_gateway_not_configured");
      const isZh = (chart.lang ?? "en") === "zh";
      const titles = isZh ? CHAPTER_TITLES_ZH : CHAPTER_TITLES_EN;

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

      const chapters: PremiumChapter[] = [];
      for (const key of CHAPTER_KEYS) {
        const title = titles[key];
        let body = "";
        try {
          body = await generateChapter(key, title, chartFacts, webReportText, isZh, apiKey);
        } catch (err) {
          body = isZh
            ? `本章生成暂时不可用（${safeMessage(err, "AI error")}）。可稍后重试。`
            : `This chapter is temporarily unavailable (${safeMessage(err, "AI error")}). Retry later.`;
        }
        chapters.push({ key, title, body });
      }

      const content: PremiumContent = {
        meta: {
          prompt_version: PREMIUM_PROMPT_VERSION,
          report_version: PREMIUM_REPORT_VERSION,
          generated_at: new Date().toISOString(),
          lang: isZh ? "zh" : "en",
          chart_name: chart.name ?? null,
          disclaimer: isZh ? DISCLAIMER_ZH : DISCLAIMER_EN,
        },
        cover: {
          title: isZh ? "命运图书馆 · 高级 AI 深度报告" : "Library of Destiny — Premium Deep Reading",
          subtitle: chart.name ?? (isZh ? "私人命盘解读" : "Personal chart reading"),
        },
        chapters,
      };

      await supabaseAdmin
        .from("premium_pdf_reports")
        .update({
          status: "completed",
          content_json: content as unknown as never,
          model: "google/gemini-2.5-flash",
          provider: "lovable-ai-gateway",
          generated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      return { reportId: row.id, status: "completed" as const };
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
  status: "pending" | "generating" | "completed" | "failed";
  generatedAt: string | null;
  content: PremiumContent | null;
  errorMessage: string | null;
};

export const getPremiumReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<PremiumReportRead | null> => {
    const { supabase, userId } = context;
    // Ownership guard: chart must belong to caller.
    const { data: chart } = await supabase
      .from("charts")
      .select("id, user_id")
      .eq("id", data.chartId)
      .maybeSingle();
    if (!chart || chart.user_id !== userId) return null;

    const { data: row } = await supabase
      .from("premium_pdf_reports")
      .select("status, content_json, generated_at, error_message")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .maybeSingle();
    if (!row) return null;
    return {
      status: row.status as PremiumReportRead["status"],
      generatedAt: row.generated_at,
      content: (row.content_json as unknown as PremiumContent) ?? null,
      errorMessage: row.error_message,
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
    status: "pending" | "generating" | "completed" | "failed";
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
              status: rep.status as "pending" | "generating" | "completed" | "failed",
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
