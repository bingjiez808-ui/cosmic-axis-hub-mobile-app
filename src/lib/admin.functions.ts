import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin server functions. Every handler:
 *   1. Runs `requireSupabaseAuth` (verified Supabase session).
 *   2. Re-verifies admin role before touching admin data.
 *   3. Lazy-imports the service-role client (module is never bundled to the browser).
 */

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRole, error: adminError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminError) throw new Error("Failed to verify admin role");
    if (!adminRole) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch all auth users (paginated). For an early-stage app one page is plenty.
    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error(authErr.message);

    // The generated Database types don't include our new tables yet — cast for now.
    // biome-ignore lint: intentional untyped Data API access
    const sb = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          in: (col: string, values: string[]) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };

    const ids = authList.users.map((u) => u.id);
    const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const { data: roles } = await sb.from("user_roles").select("user_id, role").in("user_id", safeIds);
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, display_name, phone, membership_tier, membership_expires_at")
      .in("id", safeIds);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const uid = String(r.user_id);
      const arr = roleMap.get(uid) ?? [];
      arr.push(String(r.role));
      roleMap.set(uid, arr);
    });
    const profileMap = new Map<
      string,
      { displayName: string | null; phone: string | null; tier: string; expiresAt: string | null }
    >();
    (profiles ?? []).forEach((p) => {
      profileMap.set(String(p.id), {
        displayName: (p.display_name as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
        tier: (p.membership_tier as string | null) ?? "none",
        expiresAt: (p.membership_expires_at as string | null) ?? null,
      });
    });

    return authList.users.map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        displayName: p?.displayName ?? null,
        phone: p?.phone ?? null,
        membershipTier: (p?.tier as "none" | "sage" | "oracle") ?? "none",
        membershipExpiresAt: p?.expiresAt ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        provider: (u.app_metadata?.provider as string | undefined) ?? "email",
        roles: roleMap.get(u.id) ?? [],
        banned: !!(u as { banned_until?: string | null }).banned_until,
      };
    });
  });

async function ensureAdmin(context: { supabase: { from: (t: string) => unknown }; userId: string }) {
  const q = context.supabase.from("user_roles") as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await q.select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error("Failed to verify admin role");
  if (!data) throw new Error("Forbidden: admin role required");
}

const MembershipInput = z.object({
  userId: z.string().uuid(),
  tier: z.enum(["none", "sage", "oracle"]),
  expiresAt: z.string().datetime().nullable(),
});
export const setUserMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MembershipInput.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const { error } = await sb
      .from("profiles")
      .update({
        membership_tier: data.tier,
        membership_expires_at: data.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Recent 30-day window.
    const days = 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    // Fetch users created in window (via auth admin listUsers).
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });

    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{
          data: Array<{ id: string; membership_tier: string; membership_expires_at: string | null; created_at?: string; updated_at?: string }> | null;
        }>;
      };
    };
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, membership_tier, membership_expires_at, created_at, updated_at");

    // Bucket by UTC date.
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const buckets: Record<string, { newUsers: number; conversions: number }> = {};
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      buckets[dayKey(d)] = { newUsers: 0, conversions: 0 };
    }

    (list?.users ?? []).forEach((u) => {
      const k = dayKey(new Date(u.created_at));
      if (buckets[k]) buckets[k].newUsers += 1;
    });

    // Conversions: profiles with tier != 'none', bucketed by updated_at (approximation of upgrade time).
    let totalMembers = 0;
    let sageCount = 0;
    let oracleCount = 0;
    (profiles ?? []).forEach((p) => {
      if (p.membership_tier && p.membership_tier !== "none") {
        totalMembers += 1;
        if (p.membership_tier === "sage") sageCount += 1;
        if (p.membership_tier === "oracle") oracleCount += 1;
        const when = p.updated_at ?? p.created_at;
        if (when) {
          const k = dayKey(new Date(when));
          if (buckets[k]) buckets[k].conversions += 1;
        }
      }
    });

    const series = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));

    return {
      totals: {
        totalUsers: list?.users.length ?? 0,
        totalMembers,
        sage: sageCount,
        oracle: oracleCount,
      },
      series,
    };
  });

const SendResetInput = z.object({ email: z.string().email() });
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendResetInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: adminRole, error: adminError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminError) throw new Error("Failed to verify admin role");
    if (!adminRole) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const siteUrl =
      process.env.SITE_URL ??
      process.env.VITE_SITE_URL ??
      "https://fate-nexus-ai.lovable.app";
    // Generates a recovery link and triggers the recovery email via GoTrue.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${siteUrl}/auth?reset=1`,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const SetPasswordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
});
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetPasswordInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: adminRole, error: adminError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminError) throw new Error("Failed to verify admin role");
    if (!adminRole) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const UpdateProfileInput = z.object({
  userId: z.string().uuid(),
  displayName: z.string().trim().max(80).nullable(),
});
export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: adminRole, error: adminError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminError) throw new Error("Failed to verify admin role");
    if (!adminRole) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    };
    const { error } = await sb
      .from("profiles")
      .update({ display_name: data.displayName, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
