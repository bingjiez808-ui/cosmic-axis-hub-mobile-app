import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  LITERATURE_CONTENT_VERSION,
  LITERATURE_PROMPT_VERSION,
  type ConcernKey,
  type ToneKey,
} from "@/lib/literature-constants";

/**
 * Literature Hall — server functions.
 *
 * Recommendation is deterministic and DB-driven: AI never invents passages
 * or authors. All AI-generated bridge text (future extension) must sit
 * alongside the referenced passage_id in `user_literature_recommendations`
 * so it can be cached and audited.
 */

export type PassageRow = {
  id: string;
  slug: string;
  display_text_zh: string | null;
  display_text_en: string | null;
  original_text: string;
  context_zh: string | null;
  context_en: string | null;
  default_interpretation_zh: string | null;
  default_interpretation_en: string | null;
  action_prompt_zh: string | null;
  action_prompt_en: string | null;
  question_zh: string | null;
  question_en: string | null;
  citation_label: string | null;
  life_stage_tags: string[];
  concern_tags: string[];
  tone_tags: string[];
  reading_path: string | null;
  work: {
    id: string;
    slug: string;
    title_zh: string | null;
    title_original: string | null;
    author_zh: string | null;
    author_original: string | null;
    language: string;
    country_or_region: string | null;
    era: string | null;
  };
};

export type RecommendationRow = {
  id: string;
  passage: PassageRow;
  saved: boolean;
  annotation: string | null;
  ranking_reasons: {
    stage?: number;
    concern?: number;
    tone?: number;
    novelty?: number;
    total?: number;
    matched_stage?: string | null;
    matched_concern?: string | null;
    matched_tone?: string | null;
  };
  life_stage: string | null;
  concern: string | null;
  reading_tone: string | null;
  content_version: string;
};

/* ── preferences ────────────────────────────────────────────────── */

export type LiteraturePreferences = {
  preferred_tones: string[];
  preferred_regions: string[];
  prefers_classical: boolean;
  prefers_modern: boolean;
  show_age_on_share: boolean;
};

export const getLiteraturePreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiteraturePreferences | null> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_literature_preferences")
      .select("preferred_tones, preferred_regions, prefers_classical, prefers_modern, show_age_on_share")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as LiteraturePreferences | null) ?? null;
  });

const PreferencesSchema = z.object({
  preferred_tones: z.array(z.string()).max(10).default([]),
  preferred_regions: z.array(z.string()).max(10).default([]),
  prefers_classical: z.boolean().default(true),
  prefers_modern: z.boolean().default(true),
  show_age_on_share: z.boolean().default(true),
});

export const saveLiteraturePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PreferencesSchema.parse(v))
  .handler(async ({ context, data }): Promise<LiteraturePreferences> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_literature_preferences")
      .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("preferred_tones, preferred_regions, prefers_classical, prefers_modern, show_age_on_share")
      .single();
    if (error) throw new Error(error.message);
    return row as LiteraturePreferences;
  });

/* ── recommend / next-page ──────────────────────────────────────── */

const RecommendInput = z.object({
  life_stage: z.string().nullable().optional(),
  concern: z.string().min(1),
  reading_tone: z.string().min(1),
  chart_id: z.string().uuid().nullable().optional(),
  exclude_passage_ids: z.array(z.string().uuid()).max(200).default([]),
});

function buildUniqueKey(input: {
  chart_id: string | null | undefined;
  life_stage: string | null | undefined;
  concern: string;
  reading_tone: string;
  passage_id: string;
}): string {
  return [
    input.chart_id ?? "no-chart",
    input.life_stage ?? "any",
    input.concern,
    input.reading_tone,
    LITERATURE_CONTENT_VERSION,
    input.passage_id,
  ].join("|");
}

function scorePassage(
  p: PassageRow,
  lifeStage: string | null,
  concern: string,
  tone: string,
  recentPassageIds: Set<string>,
): {
  total: number;
  stage: number;
  concern: number;
  tone: number;
  novelty: number;
  matched_stage: string | null;
  matched_concern: string | null;
  matched_tone: string | null;
} {
  // Spec weights: stage 30, concern 30, chart-tendency 20 (v1 skipped),
  // tone 15, novelty 5. In v1 we redistribute the chart-tendency slot
  // evenly to stage/concern so ranking still sums to 100.
  let stage = 0;
  let matched_stage: string | null = null;
  if (lifeStage && p.life_stage_tags.includes(lifeStage)) {
    stage = 40;
    matched_stage = lifeStage;
  } else if (!lifeStage) {
    stage = 20;
  }

  let concernScore = 0;
  let matched_concern: string | null = null;
  if (concern !== "any" && p.concern_tags.includes(concern)) {
    concernScore = 40;
    matched_concern = concern;
  } else if (concern === "any") {
    concernScore = 20;
  }

  let toneScore = 0;
  let matched_tone: string | null = null;
  if (tone !== "any" && tone !== "auto" && p.tone_tags.includes(tone)) {
    toneScore = 15;
    matched_tone = tone;
  } else if (tone === "any" || tone === "auto") {
    toneScore = 8;
  }

  const novelty = recentPassageIds.has(p.id) ? 0 : 5;
  const total = stage + concernScore + toneScore + novelty;
  return {
    total,
    stage,
    concern: concernScore,
    tone: toneScore,
    novelty,
    matched_stage,
    matched_concern,
    matched_tone,
  };
}

export const recommendLiteraturePassage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RecommendInput.parse(v))
  .handler(async ({ context, data }): Promise<RecommendationRow | null> => {
    const { supabase, userId } = context;

    // Pull candidate passages. Prefer filtered by concern/stage first for
    // efficiency, but fall back to broad pull if the pool is too thin.
    const buildQuery = () =>
      supabase
        .from("literature_passages")
        .select(
          `id, slug, display_text_zh, display_text_en, original_text,
           context_zh, context_en, default_interpretation_zh, default_interpretation_en,
           action_prompt_zh, action_prompt_en, question_zh, question_en, citation_label,
           life_stage_tags, concern_tags, tone_tags, reading_path,
           work:work_id ( id, slug, title_zh, title_original, author_zh, author_original, language, country_or_region, era )`,
        )
        .eq("active", true)
        .limit(200);

    let query = buildQuery();
    if (data.concern !== "any") {
      query = query.contains("concern_tags", [data.concern]);
    }
    let { data: pool } = await query;
    if (!pool || pool.length < 4) {
      const { data: full } = await buildQuery();
      pool = full ?? [];
    }
    if (pool.length === 0) return null;

    // Recent-30 novelty penalty pool
    const { data: recent } = await supabase
      .from("user_literature_recommendations")
      .select("passage_id, last_viewed_at")
      .eq("user_id", userId)
      .order("last_viewed_at", { ascending: false })
      .limit(30);
    const recentIds = new Set<string>((recent ?? []).map((r) => r.passage_id));
    for (const ex of data.exclude_passage_ids) recentIds.add(ex);

    const scored = (pool as unknown as PassageRow[])
      .filter((p) => !data.exclude_passage_ids.includes(p.id))
      .map((p) => ({
        passage: p,
        score: scorePassage(p, data.life_stage ?? null, data.concern, data.reading_tone, recentIds),
      }))
      .sort((a, b) => b.score.total - a.score.total);

    if (scored.length === 0) return null;

    // Small top-k random pick to feel "the library turned a page"
    const topK = scored.slice(0, Math.min(5, scored.length));
    const pick = topK[Math.floor(Math.random() * topK.length)];

    const uniqueKey = buildUniqueKey({
      chart_id: data.chart_id ?? null,
      life_stage: data.life_stage ?? null,
      concern: data.concern,
      reading_tone: data.reading_tone,
      passage_id: pick.passage.id,
    });

    const ranking_reasons = {
      stage: pick.score.stage,
      concern: pick.score.concern,
      tone: pick.score.tone,
      novelty: pick.score.novelty,
      total: pick.score.total,
      matched_stage: pick.score.matched_stage,
      matched_concern: pick.score.matched_concern,
      matched_tone: pick.score.matched_tone,
    };

    // Upsert recommendation row (idempotent for identical context)
    const { data: existing } = await supabase
      .from("user_literature_recommendations")
      .select("id, saved")
      .eq("user_id", userId)
      .eq("unique_key", uniqueKey)
      .maybeSingle();

    let recId: string;
    let saved = false;
    if (existing) {
      recId = existing.id;
      saved = !!existing.saved;
      await supabase
        .from("user_literature_recommendations")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("id", recId);
    } else {
      const { data: ins, error } = await supabase
        .from("user_literature_recommendations")
        .insert({
          user_id: userId,
          chart_id: data.chart_id ?? null,
          passage_id: pick.passage.id,
          life_stage: data.life_stage ?? null,
          concern: data.concern,
          reading_tone: data.reading_tone,
          ranking_score: pick.score.total,
          ranking_reasons,
          prompt_version: LITERATURE_PROMPT_VERSION,
          content_version: LITERATURE_CONTENT_VERSION,
          unique_key: uniqueKey,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      recId = ins.id;
    }

    // Load annotation (if any)
    const { data: ann } = await supabase
      .from("user_literature_annotations")
      .select("annotation")
      .eq("user_id", userId)
      .eq("recommendation_id", recId)
      .maybeSingle();

    return {
      id: recId,
      passage: pick.passage,
      saved,
      annotation: ann?.annotation ?? null,
      ranking_reasons,
      life_stage: data.life_stage ?? null,
      concern: data.concern,
      reading_tone: data.reading_tone,
      content_version: LITERATURE_CONTENT_VERSION,
    };
  });

/* ── bookmark toggle ────────────────────────────────────────────── */

export const toggleLiteratureBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ recommendation_id: z.string().uuid(), saved: z.boolean() }).parse(v),
  )
  .handler(async ({ context, data }): Promise<{ saved: boolean }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_literature_recommendations")
      .update({ saved: data.saved })
      .eq("id", data.recommendation_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { saved: data.saved };
  });

/* ── annotations ────────────────────────────────────────────────── */

export const saveLiteratureAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        recommendation_id: z.string().uuid(),
        annotation: z.string().max(2000),
        visibility: z.enum(["private", "share_only"]).default("private"),
      })
      .parse(v),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    // Upsert by (user_id, recommendation_id) — but there's no unique constraint,
    // so read-then-update/insert.
    const { data: existing } = await supabase
      .from("user_literature_annotations")
      .select("id")
      .eq("user_id", userId)
      .eq("recommendation_id", data.recommendation_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("user_literature_annotations")
        .update({
          annotation: data.annotation,
          visibility: data.visibility,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: ins, error } = await supabase
      .from("user_literature_annotations")
      .insert({
        user_id: userId,
        recommendation_id: data.recommendation_id,
        annotation: data.annotation,
        visibility: data.visibility,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/* ── list saved bookmarks ────────────────────────────────────────── */

export type SavedBookmarkRow = {
  id: string;
  saved_at: string;
  passage: PassageRow;
  annotation: string | null;
};

export const listSavedLiterature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedBookmarkRow[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_literature_recommendations")
      .select(
        `id, last_viewed_at,
         passage:passage_id (
           id, slug, display_text_zh, display_text_en, original_text,
           context_zh, context_en, default_interpretation_zh, default_interpretation_en,
           action_prompt_zh, action_prompt_en, question_zh, question_en, citation_label,
           life_stage_tags, concern_tags, tone_tags, reading_path,
           work:work_id ( id, slug, title_zh, title_original, author_zh, author_original, language, country_or_region, era )
         )`,
      )
      .eq("user_id", userId)
      .eq("saved", true)
      .order("last_viewed_at", { ascending: false })
      .limit(50);
    if (!data) return [];
    // Attach annotations
    const ids = data.map((r: { id: string }) => r.id);
    const { data: anns } = ids.length
      ? await supabase
          .from("user_literature_annotations")
          .select("recommendation_id, annotation")
          .eq("user_id", userId)
          .in("recommendation_id", ids)
      : { data: [] as { recommendation_id: string; annotation: string }[] };
    const annMap = new Map<string, string>();
    for (const a of anns ?? []) annMap.set(a.recommendation_id, a.annotation);
    return data.map(
      (r: { id: string; last_viewed_at: string; passage: PassageRow }) => ({
        id: r.id,
        saved_at: r.last_viewed_at,
        passage: r.passage,
        annotation: annMap.get(r.id) ?? null,
      }),
    );
  });
