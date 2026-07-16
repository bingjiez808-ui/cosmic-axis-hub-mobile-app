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
  lang: z.enum(["en", "zh"]).default("en"),
});
export type ChartInput = z.infer<typeof ChartInputSchema>;

/**
 * Only the fields that actually influence the reading enter the hash.
 * Display name is intentionally excluded so a user renaming their chart
 * does not blow away a previously generated report.
 */
export function normalizeForHash(input: ChartInput) {
  return {
    date: (input.date ?? "").trim(),
    time: (input.time ?? "").trim(),
    place: (input.place ?? "").trim().toLowerCase(),
    lang: input.lang ?? "en",
  };
}

export function computeChartHash(input: ChartInput): string {
  const canonical = JSON.stringify(normalizeForHash(input));
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
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

    // Non-destructive upsert: if the row already exists for this user we
    // keep the earlier `name` / snapshot and just return it.
    const { data: existing } = await supabase
      .from("charts")
      .select("id, name")
      .eq("user_id", userId)
      .eq("normalized_input_hash", hash)
      .maybeSingle();
    if (existing?.id) return { chartId: existing.id, hash, created: false };

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
    if (error || !inserted) throw new Error("Failed to save chart");
    return { chartId: inserted.id, hash, created: true };
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
    if (!isEmailVerified(context.claims)) {
      throw new Error("email_not_verified");
    }
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
      .select("id, name, birth_date, birth_time, birth_place, lang, created_at, updated_at")
      .eq("user_id", userId)
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
    return charts.map((c) => ({ ...c, reports: byChart.get(c.id) ?? [] }));
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
/* Email-verified guard                                                  */
/* --------------------------------------------------------------------- */

type Claims = {
  email_verified?: boolean;
  email?: string;
  user_metadata?: { email_verified?: boolean };
  app_metadata?: { provider?: string; providers?: string[] };
};

export function isEmailVerified(claims: unknown): boolean {
  const c = (claims ?? {}) as Claims;
  // Explicit top-level flag (present on most Supabase JWTs).
  if (c.email_verified === true) return true;
  if (c.user_metadata?.email_verified === true) return true;
  // Third-party OAuth providers (Google, Apple, etc.) return verified users.
  const provs = new Set<string>([
    ...(c.app_metadata?.provider ? [c.app_metadata.provider] : []),
    ...(c.app_metadata?.providers ?? []),
  ]);
  if ([...provs].some((p) => p !== "email" && p !== "phone")) return true;
  return false;
}
