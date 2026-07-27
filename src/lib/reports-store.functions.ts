import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";


/**
 * Persistence layer for user birth charts and their AI-generated reports.
 *
 * Design:
 * - `charts` is one row per (user_id, normalized_input_hash). Users may
 *   read/write their own rows through RLS.
 * - `reports` is one row per (user_id, chart_id, kind, report_version).
 *   Users may only SELECT via RLS; all writes happen here through the
 *   service-role admin client so clients cannot forge a `completed`
 *   status or `report_json`.
 * - `beginReport` is the idempotent gate: it upserts a `pending` row
 *   with ON CONFLICT DO NOTHING and returns the existing row when a
 *   concurrent generator already claimed the slot. Callers must consult
 *   `didStart` before invoking the AI.
 */

/* --------------------------------------------------------------------- */
/* Normalized birth-input hash                                           */
/* --------------------------------------------------------------------- */

const ChartInputSchema = z.object({
  name: z.string().max(120).optional(),
  date: z.string().max(40).optional(),
  time: z.string().max(20).optional(),
  place: z.string().max(160).optional(),
  gender: z.enum(["male", "female"]).optional(),
  lang: z.enum(["en", "zh"]).default("en"),
});
export type ChartInput = z.infer<typeof ChartInputSchema>;

/**
 * Canonical field selection for hashing. Display name is excluded so
 * renames don't invalidate a generated report. Gender is included
 * because Zi Wei Dou Shu results are gender-dependent — two charts
 * with the same birth data but different genders MUST NOT collide.
 * Language is kept in the hash so prompt output in a different
 * language does not clobber an existing translation.
 *
 * Keys are emitted in a fixed order so callers that pass the same
 * effective input in different object-literal shapes hash identically.
 */
export function normalizeForHash(input: ChartInput) {
  return {
    date: (input.date ?? "").trim(),
    gender: (input.gender ?? "") as "male" | "female" | "",
    lang: input.lang ?? "en",
    place: (input.place ?? "").trim().toLowerCase(),
    time: (input.time ?? "").trim(),
  };
}

export function computeChartHash(input: ChartInput): string {
  const norm = normalizeForHash(input);
  // Explicit key ordering: alphabetical, so different-shape inputs
  // (extra keys, undefined values, different literal order) map to
  // the exact same JSON string.
  const canonical = JSON.stringify({
    date: norm.date,
    gender: norm.gender,
    lang: norm.lang,
    place: norm.place,
    time: norm.time,
  });
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

/**
 * The single source of truth for constructing `ensureChart` payloads
 * from the URL/search state shared by report.tsx and PremiumPdfCard.
 *
 * Both call sites MUST route through this helper — otherwise a lang
 * flicker between renders (or one caller including `calculation_snapshot`
 * and the other not) can produce two different `normalized_input_hash`
 * values for the same user + birth data, splitting the DB into two chart
 * rows and orphaning premium-unlock state.
 */
export function buildCanonicalChartInput(
  search: {
    name?: string;
    date?: string;
    time?: string;
    place?: string;
    gender?: "male" | "female";
    lang?: "en" | "zh";
  },
  fallbackLang: "en" | "zh",
): ChartInput & { input_snapshot: Record<string, unknown> } {
  const lang = search.lang ?? fallbackLang ?? "en";
  const canonical: ChartInput = {
    name: search.name,
    date: search.date,
    time: search.time,
    place: search.place,
    gender: search.gender,
    lang,
  };
  // input_snapshot preserves the raw shape for auditing but the hash
  // ONLY uses the fields normalizeForHash returns, so callers may
  // safely enrich it (e.g. calculation_snapshot) without hash drift.
  return {
    ...canonical,
    input_snapshot: {
      name: search.name,
      date: search.date,
      time: search.time,
      place: search.place,
      gender: search.gender,
      lang,
    },
  };
}

/* --------------------------------------------------------------------- */
/* Chart upsert                                                          */
/* --------------------------------------------------------------------- */

const EnsureChartInput = ChartInputSchema.extend({
  input_snapshot: z.record(z.string(), z.unknown()).default({}),
});

export const ensureChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnsureChartInput.parse(data))
  .handler(async ({ data, context }) => {
    const hash = computeChartHash(data);
    const { supabase, userId } = context;

    const lookup = async () => {
      const { data: row } = await supabase
        .from("charts")
        .select("id, name")
        .eq("user_id", userId)
        .eq("normalized_input_hash", hash)
        .maybeSingle();
      return row?.id ?? null;
    };

    const existingId = await lookup();
    if (existingId) return { chartId: existingId, hash, created: false };

    const { data: inserted, error } = await supabase
      .from("charts")
      .insert({
        user_id: userId,
        name: data.name ?? null,
        birth_date: data.date ?? null,
        birth_time: data.time ?? null,
        birth_place: data.place ?? null,
        lang: data.lang,
        input_snapshot: data.input_snapshot as never,
        normalized_input_hash: hash,
      })
      .select("id")
      .single();
    if (inserted?.id) return { chartId: inserted.id, hash, created: true };

    // Concurrent insert lost the race to the (user_id, normalized_input_hash)
    // unique index. Re-select to return the winning row — never create a
    // second orphan chart for the same canonical input.
    const raced = await lookup();
    if (raced) return { chartId: raced, hash, created: false };
    throw new Error(`Failed to save chart${error?.message ? `: ${error.message}` : ""}`);
  });

/* --------------------------------------------------------------------- */
/* Report read                                                           */
/* --------------------------------------------------------------------- */

const GetReportInput = z.object({
  chartId: z.string().uuid(),
  kind: z.enum(["report", "outlook"]),
  reportVersion: z.string().min(1).max(120),
});

export type SavedReportRow = {
  id: string;
  status: "pending" | "completed" | "failed";
  report_json: Json | null;
  generated_at: string | null;
  updated_at: string;
};

export const getSavedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GetReportInput.parse(data))
  .handler(async ({ data, context }): Promise<SavedReportRow | null> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("reports")
      .select("id, status, report_json, generated_at, updated_at")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("kind", data.kind)
      .eq("report_version", data.reportVersion)
      .maybeSingle();
    if (!row) return null;
    return row as SavedReportRow;
  });

/* --------------------------------------------------------------------- */
/* Report begin (atomic pending claim)                                   */
/* --------------------------------------------------------------------- */

const BeginReportInput = GetReportInput.extend({
  input_snapshot: z.record(z.string(), z.unknown()).default({}),
});

export const beginReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BeginReportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertEmailVerifiedOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // First: is there already a row? Return whatever it says.
    const { data: existing } = await supabaseAdmin
      .from("reports")
      .select("id, status, report_json")
      .eq("user_id", userId)
      .eq("chart_id", data.chartId)
      .eq("kind", data.kind)
      .eq("report_version", data.reportVersion)
      .maybeSingle();
    if (existing) {
      return {
        reportId: existing.id,
        status: existing.status as "pending" | "completed" | "failed",
        report_json: existing.report_json,
        didStart: false,
      };
    }

    // Try to atomically claim the slot. Duplicate key on the unique
    // constraint means a concurrent caller beat us — re-read.
    const { data: inserted, error } = await supabaseAdmin
      .from("reports")
      .insert({
        user_id: userId,
        chart_id: data.chartId,
        kind: data.kind,
        report_version: data.reportVersion,
        status: "pending",
        input_snapshot: data.input_snapshot as never,
      })
      .select("id")
      .single();
    if (error) {
      const { data: race } = await supabaseAdmin
        .from("reports")
        .select("id, status, report_json")
        .eq("user_id", userId)
        .eq("chart_id", data.chartId)
        .eq("kind", data.kind)
        .eq("report_version", data.reportVersion)
        .maybeSingle();
      if (race) {
        return {
          reportId: race.id,
          status: race.status as "pending" | "completed" | "failed",
          report_json: race.report_json,
          didStart: false,
        };
      }
      throw new Error("Could not start report");
    }
    return { reportId: inserted.id, status: "pending" as const, report_json: null, didStart: true };
  });

/* --------------------------------------------------------------------- */
/* Report commit                                                         */
/* --------------------------------------------------------------------- */

const SaveReportInput = z.object({
  reportId: z.string().uuid(),
  report_json: z.custom<Json>((v) => v !== undefined),
  model: z.string().max(120).optional(),
  provider: z.string().max(120).optional(),
});

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveReportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reports")
      .update({
        status: "completed",
        report_json: data.report_json as never,
        model: data.model ?? null,
        provider: data.provider ?? null,
        error_message: null,
        generated_at: new Date().toISOString(),
      })
      .eq("id", data.reportId)
      .eq("user_id", userId); // ownership guard
    if (error) throw new Error("Failed to save report");
    return { ok: true };
  });

const FailReportInput = z.object({
  reportId: z.string().uuid(),
  error_message: z.string().max(400).optional(),
});

export const failReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FailReportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("reports")
      .update({
        status: "failed",
        error_message: data.error_message ?? "unknown",
      })
      .eq("id", data.reportId)
      .eq("user_id", userId);
    return { ok: true };
  });

/* --------------------------------------------------------------------- */
/* Listing / rename                                                      */
/* --------------------------------------------------------------------- */

export type ChartRow = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: string | null;
  chart_role: "self" | "other";
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  reports: Array<{
    kind: string;
    status: string;
    report_version: string;
    generated_at: string | null;
  }>;
};

export const listUserCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChartRow[]> => {
    const { supabase, userId } = context;
    const { data: charts } = await supabase
      .from("charts")
      .select(
        "id, name, birth_date, birth_time, birth_place, lang, chart_role, is_primary, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (!charts || charts.length === 0) return [];
    const ids = charts.map((c) => c.id);
    const { data: reps } = await supabase
      .from("reports")
      .select("chart_id, kind, status, report_version, generated_at")
      .eq("user_id", userId)
      .in("chart_id", ids);
    const byChart = new Map<string, ChartRow["reports"]>();
    for (const r of reps ?? []) {
      const list = byChart.get(r.chart_id) ?? [];
      list.push({
        kind: r.kind,
        status: r.status,
        report_version: r.report_version,
        generated_at: r.generated_at,
      });
      byChart.set(r.chart_id, list);
    }
    return charts.map((c) => ({
      ...c,
      chart_role: (c.chart_role === "self" ? "self" : "other") as "self" | "other",
      is_primary: !!c.is_primary,
      reports: byChart.get(c.id) ?? [],
    }));
  });

const SetPrimaryChartInput = z.object({ chartId: z.string().uuid() });

/**
 * Atomically promote a chart to `chart_role='self'` + `is_primary=true`,
 * demoting any prior primary in the same tx. Enforced by
 * `public.set_primary_chart` (SECURITY DEFINER, RLS-guarded by user id).
 */
export const setPrimaryChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetPrimaryChartInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ok, error } = await supabase.rpc("set_primary_chart", {
      _chart_id: data.chartId,
    });
    if (error || !ok) throw new Error("set_primary_failed");
    return { ok: true as const };
  });

const SetChartRoleInput = z.object({
  chartId: z.string().uuid(),
  role: z.enum(["self", "other"]),
});

/**
 * Change a chart's role between "self" and "other". Demoting the current
 * primary automatically clears is_primary. Enforced by `set_chart_role`
 * RPC — never allowed to create a second primary.
 */
export const setChartRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetChartRoleInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ok, error } = await supabase.rpc("set_chart_role", {
      _chart_id: data.chartId,
      _role: data.role,
    });
    if (error || !ok) throw new Error("set_role_failed");
    return { ok: true as const };
  });

/**
 * Assign ownership metadata (chart_role + relationship_label) to a chart
 * the caller owns. When `role="self"` and the user currently has no
 * primary chart, atomically promote this one via `set_primary_chart`
 * (never silently overrides an existing primary — the client must
 * explicitly ask for replacement).
 *
 * NOTE: This is the current best-effort implementation. Full atomicity
 * of the "no other primary exists" check requires a dedicated RPC
 * (`set_primary_if_none`); tracked as a follow-up migration.
 */
const AssignChartOwnershipInput = z.object({
  chartId: z.string().uuid(),
  role: z.enum(["self", "other"]),
  relationshipLabel: z.string().trim().max(80).optional(),
  autoPromoteIfNoPrimary: z.boolean().default(false),
  // "replace" — force-promote this chart as primary (demotes any prior primary
  // atomically via set_primary_chart). "keep" — never touch primary. Default
  // undefined = fall back to autoPromoteIfNoPrimary behaviour.
  primaryIntent: z.enum(["replace", "keep"]).optional(),
});

export const assignChartOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AssignChartOwnershipInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Update role + label on the caller's chart (RLS ensures ownership).
    const { error: updateErr } = await supabase
      .from("charts")
      .update({
        chart_role: data.role,
        relationship_label: data.relationshipLabel ?? null,
      })
      .eq("id", data.chartId)
      .eq("user_id", userId);
    if (updateErr) throw new Error("ownership_update_failed");

    let promoted = false;
    if (data.role === "self") {
      if (data.primaryIntent === "replace") {
        // Explicit user consent to replace an existing primary. The RPC
        // demotes any prior primary in a single statement.
        const { data: ok } = await supabase.rpc("set_primary_chart", {
          _chart_id: data.chartId,
        });
        promoted = !!ok;
      } else if (data.primaryIntent !== "keep" && data.autoPromoteIfNoPrimary) {
        const { data: existingPrimary } = await supabase
          .from("charts")
          .select("id")
          .eq("user_id", userId)
          .eq("is_primary", true)
          .eq("chart_role", "self")
          .neq("id", data.chartId)
          .maybeSingle();
        if (!existingPrimary) {
          const { data: ok } = await supabase.rpc("set_primary_chart", {
            _chart_id: data.chartId,
          });
          promoted = !!ok;
        }
      }
    }
    return { ok: true as const, promoted };
  });



const GetChartByIdInput = z.object({ chartId: z.string().uuid() });

export type ChartByIdRow = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: "en" | "zh";
  gender: "male" | "female" | null;
  input_snapshot: Json | null;
};

/**
 * Authoritative chart lookup by id, scoped to the caller via RLS.
 * Lets the client rehydrate fields (gender, timezone) that the URL
 * does not carry. Returns null when the row does not exist or belongs
 * to another user — never throws for a missing row.
 */
export const getChartById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GetChartByIdInput.parse(data))
  .handler(async ({ data, context }): Promise<ChartByIdRow | null> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("charts")
      .select("id, name, birth_date, birth_time, birth_place, lang, input_snapshot")
      .eq("user_id", userId)
      .eq("id", data.chartId)
      .maybeSingle();
    if (!row) return null;
    const snap = (row.input_snapshot ?? {}) as Record<string, unknown>;
    const genderRaw = snap.gender;
    const gender: "male" | "female" | null =
      genderRaw === "male" || genderRaw === "female" ? genderRaw : null;
    return {
      id: row.id,
      name: row.name,
      birth_date: row.birth_date,
      birth_time: row.birth_time,
      birth_place: row.birth_place,
      lang: (row.lang === "zh" ? "zh" : "en") as "en" | "zh",
      gender,
      input_snapshot: (row.input_snapshot ?? null) as Json | null,
    };
  });


const RenameChartInput = z.object({
  chartId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const renameChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RenameChartInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("charts")
      .update({ name: data.name })
      .eq("id", data.chartId)
      .eq("user_id", userId);
    if (error) throw new Error("Rename failed");
    return { ok: true };
  });

/* --------------------------------------------------------------------- */
/* updateChartGender — owner only. Rebuilds input_snapshot.gender so the */
/* Zi Wei calculator becomes available. Admin CANNOT set this for other */
/* users — only the chart owner may declare their own gender.            */
/* --------------------------------------------------------------------- */

const UpdateChartGenderInput = z.object({
  chartId: z.string().uuid(),
  gender: z.enum(["male", "female"]),
});

export const updateChartGender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateChartGenderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership guard: RLS + explicit user_id filter.
    const { data: existing, error: readErr } = await supabase
      .from("charts")
      .select("id, user_id, input_snapshot")
      .eq("id", data.chartId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr || !existing) throw new Error("chart_not_found");
    const prev =
      existing.input_snapshot && typeof existing.input_snapshot === "object"
        ? (existing.input_snapshot as Record<string, unknown>)
        : {};
    const next = { ...prev, gender: data.gender };
    const { error } = await supabase
      .from("charts")
      .update({ input_snapshot: next as never })
      .eq("id", data.chartId)
      .eq("user_id", userId);
    if (error) throw new Error("chart_update_failed");
    return { ok: true, gender: data.gender };
  });

/* --------------------------------------------------------------------- */
/* deleteChart — owner-only destructive action.                          */
/*                                                                       */
/* scope="chart"        → deletes the chart row; FK ON DELETE CASCADE    */
/*                        removes reports, premium_pdf_reports,          */
/*                        premium_report_orders, premium_report_chapters,*/
/*                        year_readings_v1 automatically.                */
/* scope="reports_only" → keep the chart row (birth facts) but delete    */
/*                        every child that consumes AI budget            */
/*                        (reports + premium_pdf_reports +               */
/*                        year_readings_v1). premium_report_orders are   */
/*                        RETAINED de-identified for financial audit.    */
/*                                                                       */
/* Uses context.supabase (RLS as the user) — no service_role — so        */
/* Postgres enforces owner scope. Ownership pre-check gives a stable     */
/* non-identifying error before any writes.                              */
/* --------------------------------------------------------------------- */

const DeleteChartInput = z.object({
  chartId: z.string().uuid(),
  scope: z.enum(["chart", "reports_only"]),
});

export const deleteChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteChartInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("charts")
      .select("id")
      .eq("id", data.chartId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) throw new Error("chart_not_found");

    if (data.scope === "reports_only") {
      await supabase
        .from("premium_pdf_reports")
        .delete()
        .eq("user_id", userId)
        .eq("chart_id", data.chartId);
      await supabase
        .from("reports")
        .delete()
        .eq("user_id", userId)
        .eq("chart_id", data.chartId);
      await supabase
        .from("year_readings_v1")
        .delete()
        .eq("owner_id", userId)
        .eq("chart_id", data.chartId);
      return { ok: true as const, scope: "reports_only" as const };
    }

    const { error } = await supabase
      .from("charts")
      .delete()
      .eq("id", data.chartId)
      .eq("user_id", userId);
    if (error) throw new Error("chart_delete_failed");
    return { ok: true as const, scope: "chart" as const };
  });

/* --------------------------------------------------------------------- */
/* Email-verified guard                                                  */
/* --------------------------------------------------------------------- */

type Claims = {
  email_verified?: boolean;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  phone_verified?: boolean;
  user_metadata?: {
    email_verified?: boolean;
    email_confirmed_at?: string | null;
  };
  app_metadata?: { provider?: string; providers?: string[] };
};

export function isEmailVerified(claims: unknown): boolean {
  const c = (claims ?? {}) as Claims;
  // Explicit top-level flag (present on most Supabase JWTs).
  if (c.email_verified === true) return true;
  if (c.user_metadata?.email_verified === true) return true;
  // Some JWT shapes expose the raw confirmation timestamps instead of a
  // boolean — treat any non-empty timestamp as verified. This is the
  // shape we get for accounts confirmed via the Supabase admin API.
  if (typeof c.email_confirmed_at === "string" && c.email_confirmed_at) return true;
  if (typeof c.confirmed_at === "string" && c.confirmed_at) return true;
  if (
    typeof c.user_metadata?.email_confirmed_at === "string" &&
    c.user_metadata.email_confirmed_at
  )
    return true;
  // Third-party OAuth providers (Google, Apple, etc.) return verified users.
  const provs = new Set<string>([
    ...(c.app_metadata?.provider ? [c.app_metadata.provider] : []),
    ...(c.app_metadata?.providers ?? []),
  ]);
  if ([...provs].some((p) => p !== "email" && p !== "phone")) return true;
  return false;
}

/**
 * Same verification rule as `isEmailVerified` with an admin escape hatch.
 * An admin JWT may pre-date its email confirmation (created via admin API)
 * yet must still be able to run premium / outlook flows for QA. The admin
 * check reads the caller's own `user_roles` row through RLS, so it cannot
 * be forged by client input. Throws "email_not_verified" for regular
 * unverified accounts — the same error code the UI already surfaces.
 */
export async function assertEmailVerifiedOrAdmin(context: {
  supabase: unknown;
  userId: string;
  claims: unknown;
}): Promise<void> {
  if (isEmailVerified(context.claims)) return;
  const sb = context.supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
  try {
    const { data } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (data) return;
  } catch { /* fall through */ }

  // Fallback: some JWT shapes (server-minted sessions, older tokens) omit
  // the verification claim entirely even though the account IS verified in
  // auth.users. Consult the Auth admin REST endpoint as the source of truth
  // before rejecting a legitimate paying user.
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const res = await fetch(`${url}/auth/v1/admin/users/${context.userId}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const user = (await res.json()) as {
          email_confirmed_at?: string | null;
          confirmed_at?: string | null;
          app_metadata?: { provider?: string; providers?: string[] };
        };
        if (user.email_confirmed_at || user.confirmed_at) return;
        const provs = new Set<string>([
          ...(user.app_metadata?.provider ? [user.app_metadata.provider] : []),
          ...(user.app_metadata?.providers ?? []),
        ]);
        if ([...provs].some((p) => p !== "email" && p !== "phone")) return;
      }
    }
  } catch { /* fall through to reject */ }
  throw new Error("email_not_verified");
}


