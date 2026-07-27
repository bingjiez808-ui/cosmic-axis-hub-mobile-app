/**
 * life-guidance — server functions for user preferences, bookmarks and
 * responses tied to the Curator / Life Chapter / Historical Echoes UX.
 *
 * Every mutation is scoped to the signed-in user via RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIFE_STAGES } from "@/lib/life-guidance-v1";

const stageSchema = z.enum(LIFE_STAGES as unknown as [string, ...string[]]);

export const getLifeGuidancePrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_preferences" as never)
      .select("life_stage, life_stage_source, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return (data ?? null) as {
      life_stage: string | null;
      life_stage_source: "auto" | "user" | null;
      updated_at: string;
    } | null;
  });

export const setLifeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ stage: stageSchema, source: z.enum(["auto", "user"]).default("user") })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_preferences" as never)
      .upsert(
        {
          user_id: context.userId,
          life_stage: data.stage,
          life_stage_source: data.source,
        } as never,
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return { ok: true as const };
  });

export const listLifeBookmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("life_bookmarks" as never)
      .select("figure_key, stage, domain, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      figure_key: string;
      stage: string | null;
      domain: string | null;
      created_at: string;
    }>;
  });

export const toggleLifeBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        figureKey: z.string().min(1).max(64),
        stage: z.string().max(64).optional(),
        domain: z.string().max(32).optional(),
        on: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    if (data.on) {
      const { error } = await context.supabase
        .from("life_bookmarks" as never)
        .upsert(
          {
            user_id: context.userId,
            figure_key: data.figureKey,
            stage: data.stage ?? null,
            domain: data.domain ?? null,
          } as never,
          { onConflict: "user_id,figure_key" },
        );
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("life_bookmarks" as never)
        .delete()
        .eq("user_id", context.userId)
        .eq("figure_key", data.figureKey);
      if (error) throw error;
    }
    return { ok: true as const, bookmarked: data.on };
  });

export const getLifeResponse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ figureKey: z.string().min(1).max(64) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("life_responses" as never)
      .select("body, updated_at")
      .eq("user_id", context.userId)
      .eq("figure_key", data.figureKey)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return (row ?? null) as { body: string; updated_at: string } | null;
  });

export const saveLifeResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        figureKey: z.string().min(1).max(64),
        stage: z.string().max(64).optional(),
        domain: z.string().max(32).optional(),
        body: z.string().min(1).max(1200),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("life_responses" as never)
      .upsert(
        {
          user_id: context.userId,
          figure_key: data.figureKey,
          stage: data.stage ?? null,
          domain: data.domain ?? null,
          body: data.body,
        } as never,
        { onConflict: "user_id,figure_key" },
      );
    if (error) throw error;
    return { ok: true as const };
  });
