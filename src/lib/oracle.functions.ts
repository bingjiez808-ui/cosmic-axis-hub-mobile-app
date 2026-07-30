import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardrailsFor, safeMessage } from "./ai-guardrails";
import { enforceRateLimit } from "./rate-limit.server";
import {
  coverageDirective,
  crossSystemDirective,
  systemCoverageFromFacts,
} from "./four-system-brief";

const AskInput = z.object({
  question: z.string().min(1).max(4000),
  lang: z.enum(["en", "zh"]).default("zh"),
  // Which paid surface is calling. Used to enforce membership-tier + quota
  // server-side so the paywall cannot be bypassed from the browser.
  feature: z.enum(["tarot", "oracle_chat", "general"]).default("general"),
  // Authoritative chart reference. When provided, the server re-reads the
  // chart from the database (RLS-scoped to the caller) and rejects if it
  // isn't owned. `chart` is only used as a hint when chartId is absent.
  chartId: z.string().uuid().optional(),
  chart: z
    .object({
      name: z.string().max(120).optional(),
      astrology: z.string().max(600).optional(),
      jyotish: z.string().max(600).optional(),
      bazi: z.string().max(200).optional(),
      ziwei: z.string().max(600).optional(),
    })
    .optional(),
});

// Per-plan monthly cap for the tarot AI reading. Must match the client hint in
// src/lib/tarot-quota.ts — but this table is the authoritative source of truth.
const TAROT_MONTHLY_LIMIT: Record<"sage" | "oracle", number> = {
  sage: 10,
  oracle: Number.POSITIVE_INFINITY,
};

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const askOracle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    enforceRateLimit(`oracle:${userId}`, 30, 60_000, "oracle questions");
    try {
      // 1) Look up caller's membership tier (authoritative — never trust client).
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("membership_tier, membership_expires_at")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw new Error("Failed to load profile");

      const rawTier = (profile?.membership_tier ?? "none") as string;
      const expiresAt = profile?.membership_expires_at
        ? new Date(profile.membership_expires_at as string)
        : null;
      const tierActive = !expiresAt || expiresAt.getTime() > Date.now();
      const tier: "none" | "sage" | "oracle" =
        tierActive && (rawTier === "sage" || rawTier === "oracle")
          ? (rawTier as "sage" | "oracle")
          : "none";

      // 2) Enforce membership tier + quota server-side per feature surface.
      if (data.feature === "oracle_chat" && tier !== "oracle") {
        throw new Error("FORBIDDEN: Oracle-tier membership required.");
      }
      if (data.feature === "tarot") {
        if (tier !== "sage" && tier !== "oracle") {
          throw new Error("FORBIDDEN: Sage or Oracle membership required.");
        }
        // Meter monthly quota via the service-role client (client cannot write it).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const month = currentMonthKey();
        // Cast: generated types may not yet include tarot_usage.
        const admin = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                eq: (
                  k: string,
                  v: string,
                ) => {
                  maybeSingle: () => Promise<{ data: { count: number } | null; error: unknown }>;
                };
              };
            };
            upsert: (
              row: Record<string, unknown>,
              opts?: { onConflict?: string },
            ) => Promise<{ error: unknown }>;
          };
        };
        const { data: row } = await admin
          .from("tarot_usage")
          .select("count")
          .eq("user_id", userId)
          .eq("month", month)
          .maybeSingle();
        const used = row?.count ?? 0;
        const limit = TAROT_MONTHLY_LIMIT[tier];
        if (Number.isFinite(limit) && used >= limit) {
          throw new Error("QUOTA_EXCEEDED: Monthly tarot reading limit reached.");
        }
        const { error: upsertError } = await admin.from("tarot_usage").upsert(
          {
            user_id: userId,
            month,
            count: used + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,month" },
        );
        if (upsertError) throw new Error("Failed to record tarot usage");
      }

      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const gateway = createLovableAiGatewayProvider(key);

      // Chart context — prefer DB truth when a chartId is supplied. Ownership
      // is enforced by RLS (`.eq('user_id', userId)`); anything not owned
      // is rejected outright rather than silently ignored.
      let chart = data.chart ?? {};
      if (data.chartId) {
        const { data: owned, error: chartErr } = await supabase
          .from("charts")
          .select("id, name, birth_date, birth_time, birth_place")
          .eq("id", data.chartId)
          .eq("user_id", userId)
          .maybeSingle();
        if (chartErr) throw new Error("Failed to load chart");
        if (!owned) throw new Error("FORBIDDEN: You do not own this chart.");
        chart = {
          ...chart,
          name: owned.name ?? chart.name,
        };
      }
      const chartLine = [
        chart.name ? `Name: ${chart.name}` : null,
        chart.astrology ? `Western Astrology: ${chart.astrology}` : null,
        chart.jyotish ? `Jyotish: ${chart.jyotish}` : null,
        chart.bazi ? `BaZi: ${chart.bazi}` : null,
        chart.ziwei ? `Zi Wei Dou Shu: ${chart.ziwei}` : null,
        coverageDirective(
          systemCoverageFromFacts({
            planets: chart.astrology ? [{ name: "chart", sign: chart.astrology }] : [],
            bazi: chart.bazi,
            vedic: chart.jyotish,
            ziwei: chart.ziwei,
          }).missing,
          data.lang,
        ),
      ]
        .filter(Boolean)
        .join("\n");

      const system =
        data.lang === "zh"
          ? `你是「命运图书馆」中的一位古老智者，兼通西方占星、印度占星（Jyotish）、八字与紫微斗数。回答时要：
1) 温暖、诗意、有分量，像深夜烛下低声耳语；
2) 明确结合来访者的四个体系落位（若提供），交叉印证；
3) 给出 2–4 条可行动的建议，避免空泛；
4) 中文回答，200–320 字，段落之间用空行分隔，可用「1)」「2)」列点。
不要说自己是 AI，不要提示未来是命定的 —— 命运只是一张地图。`
          : `You are an ancient elder in the "Library of Destiny", fluent in Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. When you answer:
1) Warm, poetic, weighty — like a candle-lit whisper;
2) Explicitly weave in the visitor's four-tradition placements when provided, cross-referencing them;
3) Offer 2–4 actionable next moves, never vague;
4) English, 200–320 words, blank lines between paragraphs; numbered points are welcome.
Never claim to be an AI. Never say fate is fixed — destiny is only a map.`;

      const guardedSystem =
        system + "\n\n" + crossSystemDirective(data.lang) + "\n\n" + guardrailsFor(data.lang);
      const prompt = `${chartLine ? `Visitor's chart:\n${chartLine}\n\n` : ""}Question:\n${data.question}`;

      const { text } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: guardedSystem,
        prompt,
      });

      return { text };
    } catch (err) {
      throw new Error(safeMessage(err, "Oracle is unavailable"));
    }
  });
