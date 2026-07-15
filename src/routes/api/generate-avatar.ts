import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/generate-avatar
 * Generates a small animated-style portrait for the traveler based on their attributes.
 * Returns { dataUrl } — base64 PNG suitable for direct use in <img src>.
 *
 * Auth: requires a valid Supabase user session (bearer token in Authorization
 * header). Without this, anyone on the internet could burn AI-gateway image
 * credits by scripting this endpoint.
 */
export const Route = createFileRoute("/api/generate-avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Require a real Supabase user session.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabasePublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabasePublishable) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabasePublishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          house?: string;
          element?: string;
          zodiac?: string;
          title?: string;
          style?: string;
          lang?: "en" | "zh";
        };

        const house = body.house || "Aether";
        const element = body.element || "air";
        const zodiac = body.zodiac || "";
        const title = body.title || "traveler";
        const style = body.style || "mystical illustrated portrait";

        const prompt = `An illustrated animated-style portrait avatar of a mystical traveler.
Character role: "${title}" of the House of ${house}.
Elemental affinity: ${element}. Chinese zodiac companion: ${zodiac}.
Style: ${style}, painterly, luminous, dark academia + celestial library atmosphere,
soft gold candle-light rim, deep midnight background with faint constellations,
head-and-shoulders composition, symmetrical, centered, no text, no watermark,
subtle art-nouveau border, cinematic lighting. Square 1:1.`.trim();

        try {
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });
          if (!upstream.ok) {
            const text = await upstream.text();
            return new Response(text || "avatar generation failed", { status: upstream.status });
          }
          const json = (await upstream.json()) as {
            choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
          };
          const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!url) return new Response("no image returned", { status: 502 });
          return new Response(JSON.stringify({ dataUrl: url }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(String(e), { status: 500 });
        }
      },
    },
  },
});
