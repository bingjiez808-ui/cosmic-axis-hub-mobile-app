/**
 * Server functions for the deterministic year-reading pipeline.
 *
 * The engine (`./year-readings`) is a pure module — no DB, no LLM.
 * These functions bridge the engine to Supabase:
 *
 *   1. `getYearReadings` — read-only fetch of cached rows scoped to the
 *      signed-in user + chart. Never triggers computation on read.
 *   2. `ensureYearReadings` — idempotent: compute + upsert missing rows.
 *      Uses the same `PremiumFacts` shape that drives the deep report,
 *      built from the chart's stored `input_snapshot`. Zero LLM calls.
 *
 * Both use `requireSupabaseAuth` so the row-level policy sees
 * `owner_id = auth.uid()` and cannot leak across tenants.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCalculationSnapshot } from "./calc-snapshot";
import { buildPremiumFacts } from "./premium-facts";
import {
  YEAR_READING_CALC_VERSION,
  YEAR_READING_SKILL_VERSION,
  hashFactsForYearReading,
  readYearWindow,
  validateYearReading,
  type YearReading,
} from "./year-readings";
type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [k: string]: JsonValue };
type YearReadingRow = Record<string, JsonValue>;


const EnsureInput = z.object({
  chartId: z.string().uuid(),
  fromAge: z.number().int().min(0).max(120),
  toAge: z.number().int().min(0).max(120),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const GetInput = z.object({
  chartId: z.string().uuid(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

async function loadChartInputSnapshot(
  supabase: { from: (t: string) => unknown },
  chartId: string,
  userId: string,
): Promise<{
  input: {
    date: string; time: string; place: string;
    tz_offset_minutes?: number | null;
    gender?: string | null;
    lang: "zh" | "en";
  };
  birth_date: string | null;
} | null> {
  const q = supabase.from("charts") as unknown as {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown | null }> };
      };
    };
  };
  const { data } = await q
    .select("id, input_snapshot, birth_date, lang, user_id")
    .eq("id", chartId)
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as null | {
    input_snapshot: Record<string, unknown> | null;
    birth_date: string | null;
    lang: string | null;
  };
  if (!row || !row.input_snapshot) return null;
  const snap = row.input_snapshot as Record<string, unknown>;
  const date = String(snap.date ?? row.birth_date ?? "");
  const time = String(snap.time ?? "");
  const place = String(snap.place ?? "");
  const langRaw = String(snap.lang ?? row.lang ?? "zh");
  const lang = (langRaw === "en" ? "en" : "zh") as "zh" | "en";
  return {
    input: {
      date, time, place,
      tz_offset_minutes: (snap.tz_offset_minutes as number | null) ?? null,
      gender: (snap.gender as string | null) ?? null,
      lang,
    },
    birth_date: row.birth_date ?? date ?? null,
  };
}

export const ensureYearReadings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => EnsureInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.fromAge > data.toAge) {
      return { generated: 0, cached: 0, rows: [] as YearReading[], reason: "invalid_range" };
    }
    const chart = await loadChartInputSnapshot(supabase as unknown as { from: (t: string) => unknown }, data.chartId, userId);
    if (!chart) return { generated: 0, cached: 0, rows: [] as YearReading[], reason: "chart_not_found" };
    const birthISO = chart.birth_date;
    if (!birthISO) return { generated: 0, cached: 0, rows: [] as YearReading[], reason: "birth_date_missing" };
    const birthYear = Number(birthISO.slice(0, 4));
    if (!Number.isFinite(birthYear)) return { generated: 0, cached: 0, rows: [] as YearReading[], reason: "birth_year_invalid" };

    let snapshot;
    try {
      snapshot = buildCalculationSnapshot({
        date: chart.input.date,
        time: chart.input.time,
        place: chart.input.place,
        gender: (chart.input.gender as "male" | "female" | null) ?? null,
        lang: data.lang,
      });
    } catch {
      return { generated: 0, cached: 0, rows: [] as YearReading[], reason: "snapshot_failed" };
    }
    // Build birthday-anchored YYYY-MM-DD samples for each year in the
    // window so the Ziwei engine yields a per-year 流年 snapshot.
    const bMonthDay = birthISO.slice(5, 10); // MM-DD
    const ziweiYears: string[] = [];
    for (let a = data.fromAge; a <= data.toAge; a += 1) {
      const y = birthYear + a;
      if (y < 1900 || y > 2200) continue;
      ziweiYears.push(`${y}-${bMonthDay}`);
    }
    const facts = buildPremiumFacts(snapshot, { ziweiYears });
    const factsHash = hashFactsForYearReading(facts);

    // Read cached rows for this exact (chart, facts_hash, skill, calc, lang, year range).
    const readClient = supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string | number) => {
            eq: (c: string, v: string | number) => {
              eq: (c: string, v: string | number) => {
                eq: (c: string, v: string | number) => {
                  eq: (c: string, v: string | number) => {
                    gte: (c: string, v: number) => {
                      lte: (c: string, v: number) => Promise<{ data: unknown[] | null }>;
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    const { data: existing } = await readClient
      .from("year_readings_v1")
      .select("year, age, system_scores, composite_score, composite_direction, composite_confidence, evidence_refs, interpretation, advice, unavailable_systems, content_hash")
      .eq("chart_id", data.chartId)
      .eq("facts_hash", factsHash)
      .eq("calculation_version", YEAR_READING_CALC_VERSION)
      .eq("skill_version", YEAR_READING_SKILL_VERSION)
      .eq("lang", data.lang)
      .gte("year", birthYear + data.fromAge)
      .lte("year", birthYear + data.toAge);

    const cachedByYear = new Map<number, unknown>(
      (existing ?? []).map((r) => [(r as { year: number }).year, r]),
    );

    const window = readYearWindow(facts, birthYear, data.fromAge, data.toAge, data.lang);
    const toInsert: Array<Record<string, unknown>> = [];
    for (const r of window) {
      const v = validateYearReading(r);
      if (!v.ok) continue; // never persist an invalid row
      if (cachedByYear.has(r.year)) continue;
      toInsert.push({
        owner_id: userId,
        chart_id: data.chartId,
        facts_hash: factsHash,
        calculation_version: YEAR_READING_CALC_VERSION,
        skill_version: YEAR_READING_SKILL_VERSION,
        lang: data.lang,
        year: r.year,
        age: r.age,
        system_scores: r.systems as unknown as Record<string, unknown>,
        composite_score: r.composite_score,
        composite_direction: r.composite_direction,
        composite_confidence: r.composite_confidence,
        evidence_refs: r.evidence_refs,
        interpretation: r.interpretation,
        advice: r.advice,
        unavailable_systems: r.unavailable_systems,
        content_hash: r.content_hash,
      });
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const upsertClient = supabase as unknown as {
        from: (t: string) => {
          upsert: (rows: unknown[], opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{
            data: unknown[] | null; error: unknown;
          }>;
        };
      };
      const { data: ret } = await upsertClient
        .from("year_readings_v1")
        .upsert(toInsert, {
          onConflict: "chart_id,facts_hash,calculation_version,skill_version,lang,year",
          ignoreDuplicates: true,
        });
      inserted = (ret as unknown[] | null)?.length ?? toInsert.length;
    }

    return {
      generated: inserted,
      cached: (existing ?? []).length,
      rows: window,
      reason: "ok",
    };
  });

export const getYearReadings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => GetInput.parse(raw))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{ data: YearReadingRow[] | null }>;
            };
          };
        };
      };
    };
    const { data: rows } = await client
      .from("year_readings_v1")
      .select("year, age, system_scores, composite_score, composite_direction, composite_confidence, evidence_refs, interpretation, advice, unavailable_systems, content_hash, skill_version")
      .eq("chart_id", data.chartId)
      .eq("lang", data.lang)
      .order("year", { ascending: true });
    return { rows: JSON.parse(JSON.stringify(rows ?? [])) as YearReadingRow[] };
  });
