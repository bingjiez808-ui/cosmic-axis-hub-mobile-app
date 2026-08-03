import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Historical Figures Knowledge Base — public read server functions.
 *
 * Backed by `historical_figures`, `historical_life_events`,
 * `historical_sources`, `historical_reflections`. Data is world-readable
 * reference material (RLS opens SELECT to anon), so we go through a
 * server-local publishable client with no session — no bearer token,
 * safe to call from unauthenticated loaders.
 */

const LIFE_STAGES = [
  "learning_self",
  "early_adulthood",
  "building_life",
  "midlife_reassessment",
  "maturity_legacy",
] as const;

export type HistoricalEventRow = {
  event_key: string;
  person_key: string;
  stage: (typeof LIFE_STAGES)[number];
  domains: string[];
  tags: string[];
  signal: "opportunity" | "pressure" | "neutral";
  curated_rank: number;
  situation_zh: string;
  situation_en: string;
  tension_zh: string;
  tension_en: string;
  choice_zh: string;
  choice_en: string;
  borrow_zh: string;
  borrow_en: string;
  dont_copy_zh: string;
  dont_copy_en: string;
  person: {
    person_key: string;
    name_zh: string;
    name_en: string;
    era_zh: string;
    era_en: string;
  };
  sources: Array<{
    kind: string;
    title: string;
    url: string | null;
    license: string | null;
    is_primary: boolean;
  }>;
};

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_env_missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Return every active life-event for a given life stage, with its person
 * and public sources attached. Ordering:
 *   1. curated_rank ascending
 *   2. event_key ascending (stable tiebreak across identical ranks)
 *
 * The caller (client-side `recommendFigures`) then layers concern/domain/
 * signal scoring on top. Keeping the recommender client-side keeps the
 * scoring deterministic and inspectable without adding a Postgres function.
 */
export const listHistoricalEventsForStage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ stage: z.enum(LIFE_STAGES) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<HistoricalEventRow[]> => {
    const supabase = serverPublicClient();
    const { data: events, error } = await supabase
      .from("historical_life_events")
      .select(
        `event_key, person_key, stage, domains, tags, signal, curated_rank,
         situation_zh, situation_en, tension_zh, tension_en,
         choice_zh, choice_en, borrow_zh, borrow_en, dont_copy_zh, dont_copy_en,
         person:historical_figures!inner (person_key, name_zh, name_en, era_zh, era_en)`,
      )
      .eq("stage", data.stage)
      .eq("is_active", true)
      .order("curated_rank", { ascending: true })
      .order("event_key", { ascending: true });
    if (error) throw new Error(`historical_events_load_failed:${error.message}`);
    const rows = (events ?? []) as unknown as Array<
      Omit<HistoricalEventRow, "sources"> & {
        person: HistoricalEventRow["person"];
      }
    >;
    if (rows.length === 0) return [];

    const personKeys = Array.from(new Set(rows.map((r) => r.person_key)));
    const { data: sourceRows, error: srcErr } = await supabase
      .from("historical_sources")
      .select("person_key, kind, title, url, license, is_primary")
      .in("person_key", personKeys);
    if (srcErr) throw new Error(`historical_sources_load_failed:${srcErr.message}`);

    const byPerson = new Map<string, HistoricalEventRow["sources"]>();
    for (const s of sourceRows ?? []) {
      const arr = byPerson.get(s.person_key) ?? [];
      arr.push({
        kind: s.kind,
        title: s.title,
        url: s.url,
        license: s.license,
        is_primary: s.is_primary,
      });
      byPerson.set(s.person_key, arr);
    }
    return rows.map((r) => ({ ...r, sources: byPerson.get(r.person_key) ?? [] }));
  });

/**
 * Fetch a single event (for standalone linking, e.g. from Literature Hall).
 */
export const getHistoricalEvent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ eventKey: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<HistoricalEventRow | null> => {
    const supabase = serverPublicClient();
    const { data: row, error } = await supabase
      .from("historical_life_events")
      .select(
        `event_key, person_key, stage, domains, tags, signal, curated_rank,
         situation_zh, situation_en, tension_zh, tension_en,
         choice_zh, choice_en, borrow_zh, borrow_en, dont_copy_zh, dont_copy_en,
         person:historical_figures!inner (person_key, name_zh, name_en, era_zh, era_en)`,
      )
      .eq("event_key", data.eventKey)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(`historical_event_load_failed:${error.message}`);
    if (!row) return null;
    const typed = row as unknown as Omit<HistoricalEventRow, "sources"> & {
      person: HistoricalEventRow["person"];
    };
    const { data: sources } = await supabase
      .from("historical_sources")
      .select("kind, title, url, license, is_primary")
      .eq("person_key", typed.person_key);
    return {
      ...typed,
      sources: (sources ?? []).map((s) => ({
        kind: s.kind,
        title: s.title,
        url: s.url,
        license: s.license,
        is_primary: s.is_primary,
      })),
    };
  });
