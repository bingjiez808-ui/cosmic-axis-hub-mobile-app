/**
 * Premium ¥99 one-time PDF report — order + generation + delivery.
 *
 * Design goals:
 * - The client can NEVER mark an order paid, mint a signed URL for
 *   somebody else's PDF, or forge `report_json`. Every state transition
 *   that grants access is a service-role write on the server.
 * - Same (user_id, chart_id, product_version) can only ever have one
 *   active order and one report row — enforced by unique indexes at
 *   the DB layer, defended by atomic begin logic here.
 * - Real payment integration is intentionally NOT wired: no live
 *   merchant credentials exist. `startPremiumCheckout` records intent
 *   but returns `provider_unavailable`; the only real "paid" path is
 *   the admin `grantPremiumReportAccess` function with an audit log.
 * - PDF binary rendering is best-effort inside the Worker runtime. If
 *   the required font (CJK for zh reports) is not configured, the
 *   content JSON is still saved and the card surfaces a clear
 *   "renderer_pending" state. It NEVER falls back to a public URL or
 *   client-side download.
 */
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import { isEmailVerified } from "./reports-store.functions";

// Canonical product identity.
// v2 (¥79) is the current live product. v1 (¥99) rows remain in the DB
// untouched — historic paid/refunded orders keep their original amount
// and product_version. Queries below accept BOTH versions so historic
// buyers never lose access; new orders and grants only create v2.
export const PREMIUM_PRODUCT_VERSION = "premium_pdf_v2";
export const PREMIUM_LEGACY_PRODUCT_VERSIONS = ["premium_pdf_v1"] as const;
export const PREMIUM_ALL_PRODUCT_VERSIONS = [
  PREMIUM_PRODUCT_VERSION,
  ...PREMIUM_LEGACY_PRODUCT_VERSIONS,
] as const;
// PDF report content structure is unchanged between v1 and v2, so the
// report_version stays at v1 — a user whose v1 report is already
// completed keeps their download after the price migration.
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
  | { action: "reuse_v2_pending"; orderId: string }
  | { action: "create_v2"; amountCents: number; productVersion: string };

/**
 * Given every historic order for a (user, chart), decide what the
 * checkout flow should do. Rules:
 *   - legacy v1 status='paid' → permanently unlocked (already_paid).
 *   - legacy v1 pending/failed/refunded → IGNORED. Never reused, never
 *     blocks a new v2 purchase.
 *   - v2 status='paid' → already_paid.
 *   - v2 status='pending' → reuse.
 *   - otherwise → create a brand-new v2 order at PREMIUM_PRICE_CENTS.
 */
export function chooseCheckoutAction(orders: OrderRowLite[]): CheckoutDecision {
  const legacyPaid = orders.find(
    (o) =>
      (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(o.product_version) &&
      o.status === "paid",
  );
  if (legacyPaid) return { action: "already_paid", orderId: legacyPaid.id };

  const v2Paid = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "paid",
  );
  if (v2Paid) return { action: "already_paid", orderId: v2Paid.id };

  const v2Pending = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "pending",
  );
  if (v2Pending) return { action: "reuse_v2_pending", orderId: v2Pending.id };

  return {
    action: "create_v2",
    amountCents: PREMIUM_PRICE_CENTS,
    productVersion: PREMIUM_PRODUCT_VERSION,
  };
}

/**
 * Same rule set, applied to admin grants. Returns:
 *   - reject_legacy_v1: caller must throw already_granted_legacy_v1.
 *   - upgrade_v2_pending: flip that row to paid.
 *   - reuse_v2_paid: idempotent no-op, log audit.
 *   - create_v2_paid: insert a new v2 paid row.
 * Any legacy v1 pending/failed/refunded rows are IGNORED.
 */
export type GrantDecision =
  | { action: "reject_legacy_v1"; orderId: string }
  | { action: "reuse_v2_paid"; orderId: string }
  | { action: "upgrade_v2_pending"; orderId: string }
  | { action: "create_v2_paid" };

export function chooseGrantAction(orders: OrderRowLite[]): GrantDecision {
  const legacyPaid = orders.find(
    (o) =>
      (PREMIUM_LEGACY_PRODUCT_VERSIONS as readonly string[]).includes(o.product_version) &&
      o.status === "paid",
  );
  if (legacyPaid) return { action: "reject_legacy_v1", orderId: legacyPaid.id };

  const v2Paid = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "paid",
  );
  if (v2Paid) return { action: "reuse_v2_paid", orderId: v2Paid.id };

  const v2Pending = orders.find(
    (o) => o.product_version === PREMIUM_PRODUCT_VERSION && o.status === "pending",
  );
  if (v2Pending) return { action: "upgrade_v2_pending", orderId: v2Pending.id };

  return { action: "create_v2_paid" };
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
  } | null;
  report: {
    id: string;
    status: "pending" | "generating" | "completed" | "failed";
    hasPdf: boolean;
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

    // Legacy v1 grants access ONLY when status='paid'. v1 pending /
    // refunded / failed rows are historic artefacts and never count as
    // a live entitlement or an in-progress order.
    const { data: legacyPaid } = await supabase
      .from("premium_report_orders")
      .select("id, status, provider, paid_at")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .in("product_version", PREMIUM_LEGACY_PRODUCT_VERSIONS as unknown as string[])
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Current v2 (¥79) product — pending or paid.
    const { data: v2Active } = await supabase
      .from("premium_report_orders")
      .select("id, status, provider, paid_at")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prefer the row that grants access. A legacy v1 paid entitlement is
    // permanent; otherwise surface the live v2 order (pending or paid).
    const effective = legacyPaid ?? v2Active ?? null;

    const { data: reportRow } = await supabase
      .from("premium_pdf_reports")
      .select("id, status, pdf_storage_path, generated_at, error_message")
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
          }
        : null,
      report: reportRow
        ? {
            id: reportRow.id,
            status: reportRow.status as "pending" | "generating" | "completed" | "failed",
            hasPdf: !!reportRow.pdf_storage_path,
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
    if (!isEmailVerified(claims)) throw new Error("email_not_verified");
    enforceRateLimit(`premium-checkout:${userId}`, 10, 60_000, "premium checkouts");
    await loadChartOwnedBy(userId, data.chartId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Historic v1 (¥99) buyer already unlocked → never charge again.
    //    Only v1 status='paid' counts. v1 pending/failed/refunded are
    //    ignored entirely and MUST NOT block or be reused for v2.
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

    // 2) Existing v2 active order (pending or paid) → idempotent reuse.
    const { data: v2Existing } = await supabaseAdmin
      .from("premium_report_orders")
      .select("id, status")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("product_version", PREMIUM_PRODUCT_VERSION)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (v2Existing) {
      if (v2Existing.status === "paid") return { kind: "already_paid", orderId: v2Existing.id };
      return {
        kind: "provider_unavailable",
        orderId: v2Existing.id,
        message: "provider_pending_config",
      };
    }

    // 3) Otherwise create a brand-new v2 (¥79) pending order.
    //    Any legacy v1 pending row is intentionally left untouched.
    //    Amount, currency and product are fixed server-side.
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

    // Real payment providers are not yet configured. Return a clear
    // "unavailable" signal so the UI does NOT auto-flip to paid.
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

    // Chart must exist for the target user.
    const { data: chart } = await supabaseAdmin
      .from("charts")
      .select("id, user_id")
      .eq("id", data.chartId)
      .maybeSingle();
    if (!chart || chart.user_id !== data.userId) throw new Error("chart_not_found_for_user");

    // 1) Legacy v1 already paid → already granted. Never duplicate the
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
        action: "already_granted_legacy_v1",
        note: data.note,
      });
      throw new Error("already_granted_legacy_v1");
    }

    // 2) Look for an existing v2 order. v1 pending/failed/refunded rows
    //    are intentionally ignored and never reused / mutated.
    const { data: v2Existing } = await supabaseAdmin
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
    if (v2Existing) {
      orderId = v2Existing.id;
      if (v2Existing.status !== "paid") {
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
  status: "pending" | "paid" | "failed" | "refunded";
  provider: string | null;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  grantNote: string | null;
  hasPdf: boolean;
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
      .select("id, user_id, chart_id, status, provider, amount_cents, currency, paid_at, created_at, grant_note")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: orders } = await query;
    if (!orders || orders.length === 0) return [];

    const userIds = Array.from(new Set(orders.map((o) => o.user_id)));
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
      .select("chart_id, user_id, status, pdf_storage_path")
      .in("chart_id", chartIds);
    const reportBy = new Map<string, { status: string; hasPdf: boolean }>();
    (reports ?? []).forEach((r) => {
      reportBy.set(`${r.user_id}:${r.chart_id}`, {
        status: r.status,
        hasPdf: !!r.pdf_storage_path,
      });
    });

    const rows: AdminOrderRow[] = orders.map((o) => {
      const rep = reportBy.get(`${o.user_id}:${o.chart_id}`);
      return {
        id: o.id,
        userId: o.user_id,
        email: emailBy.get(o.user_id) ?? null,
        chartId: o.chart_id,
        chartName: chartNameBy.get(o.chart_id) ?? null,
        status: o.status as AdminOrderRow["status"],
        provider: o.provider,
        amountCents: o.amount_cents,
        currency: o.currency,
        paidAt: o.paid_at,
        createdAt: o.created_at,
        grantNote: o.grant_note,
        hasPdf: rep?.hasPdf ?? false,
        reportStatus: (rep?.status as AdminOrderRow["reportStatus"]) ?? null,
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
/* generatePremiumPdf — atomic begin + AI content + PDF render            */
/* --------------------------------------------------------------------- */

type PremiumChapter = { key: string; title: string; body: string };
type PremiumContent = {
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
    ? `你是命运图书馆资深占星与命理长者。撰写一份最终会被排版成 PDF 的深度报告的一个章节。
- 只使用来访者的真实命盘事实与已有网页报告作为依据；不使用另一个人的模板。
- 不给医疗诊断、灾祸预言或收益保证；用「倾向 / 窗口 / 可能」等谨慎措辞。
- 输出纯文本段落，不要 Markdown 标题或代码块。段落之间用一个空行分隔。
- 长度约 500-900 汉字。
${guardrails}`
    : `You are a senior elder of the Library of Destiny writing one chapter of a long-form PDF report.
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

async function beginPremiumPdfRow(userId: string, chartId: string, orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Try atomic insert of a fresh pending row.
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
    .select("id, status, content_json, pdf_storage_path")
    .single();
  if (!error && inserted) return { row: inserted, didStart: true };

  // Unique violation → someone got there first. Read back.
  const { data: existing } = await supabaseAdmin
    .from("premium_pdf_reports")
    .select("id, status, content_json, pdf_storage_path")
    .eq("user_id", userId)
    .eq("chart_id", chartId)
    .eq("report_version", PREMIUM_REPORT_VERSION)
    .maybeSingle();
  if (!existing) throw new Error("premium_row_lookup_failed");
  return { row: existing, didStart: false };
}

export const generatePremiumPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    if (!isEmailVerified(claims)) throw new Error("email_not_verified");
    enforceRateLimit(`premium-generate:${userId}`, 3, 60_000, "premium report generations");

    // 1. Chart must belong to this user.
    const chart = await loadChartOwnedBy(userId, data.chartId);

    // 2. Order must be paid.
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

    // 3. Cached completed row → return as-is.
    const { data: existing } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, status, content_json, pdf_storage_path")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .maybeSingle();
    if (existing?.status === "completed" && existing.content_json) {
      return { reportId: existing.id, status: "completed" as const, hasPdf: !!existing.pdf_storage_path };
    }

    // 4. Atomic claim.
    const { row, didStart } = await beginPremiumPdfRow(userId, data.chartId, order.id);
    if (!didStart) {
      return {
        reportId: row.id,
        status: row.status as "pending" | "generating" | "completed" | "failed",
        hasPdf: !!row.pdf_storage_path,
      };
    }

    // 5. We own generation.
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("ai_gateway_not_configured");
      const isZh = (chart.lang ?? "en") === "zh";
      const titles = isZh ? CHAPTER_TITLES_ZH : CHAPTER_TITLES_EN;

      // Pull the pre-existing web report (if any) as reference material.
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

      // Sequential to respect rate limits and preserve narrative coherence.
      const chapters: PremiumChapter[] = [];
      for (const key of CHAPTER_KEYS) {
        const title = titles[key];
        // Failure of a single chapter must NOT poison the whole report.
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
          title: isZh ? "命运图书馆 · 高级 AI 深度报告" : "Library of Destiny — Premium Deep Report",
          subtitle: chart.name ?? (isZh ? "私人命盘解读" : "Personal chart reading"),
        },
        chapters,
      };

      // Attempt PDF render. Falls back gracefully if the runtime can't
      // embed the required font for the requested language.
      let pdfPath: string | null = null;
      try {
        const { renderPremiumPdf } = await import("./premium-pdf.server");
        const pdfBytes = await renderPremiumPdf(content);
        const safeName = (chart.name ?? "report")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "report";
        const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        pdfPath = `${userId}/${data.chartId}/${safeName}-${stamp}.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("premium-pdfs")
          .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) pdfPath = null;
      } catch {
        pdfPath = null;
      }

      await supabaseAdmin
        .from("premium_pdf_reports")
        .update({
          status: "completed",
          content_json: content as unknown as never,
          model: "google/gemini-2.5-flash",
          provider: "lovable-ai-gateway",
          pdf_storage_path: pdfPath,
          generated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      return { reportId: row.id, status: "completed" as const, hasPdf: !!pdfPath };
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
/* getPremiumPdfSignedUrl — short-lived signed URL, owner only            */
/* --------------------------------------------------------------------- */

export const getPremiumPdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }): Promise<{ url: string | null; reason?: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("premium_pdf_reports")
      .select("id, user_id, status, pdf_storage_path")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("report_version", PREMIUM_REPORT_VERSION)
      .maybeSingle();
    if (!row) return { url: null, reason: "no_report" };
    if (row.user_id !== userId) return { url: null, reason: "forbidden" };
    if (row.status !== "completed") return { url: null, reason: "not_ready" };
    if (!row.pdf_storage_path) return { url: null, reason: "renderer_pending" };

    const { data: signed, error } = await supabaseAdmin.storage
      .from("premium-pdfs")
      .createSignedUrl(row.pdf_storage_path, 60 * 10); // 10 minutes
    if (error || !signed?.signedUrl) return { url: null, reason: "sign_failed" };
    return { url: signed.signedUrl };
  });
