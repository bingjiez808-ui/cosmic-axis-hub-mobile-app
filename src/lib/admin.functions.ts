import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin server functions. Every handler:
 *   1. Runs `requireSupabaseAuth` (verified Supabase session).
 *   2. Re-verifies admin role via `has_role()` before touching admin data.
 *   3. Lazy-imports the service-role client (module is never bundled to the browser).
 */

async function ensureAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } };
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

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context as never);
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
    const { data: profiles } = await sb.from("profiles").select("id, display_name").in("id", safeIds);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const uid = String(r.user_id);
      const arr = roleMap.get(uid) ?? [];
      arr.push(String(r.role));
      roleMap.set(uid, arr);
    });
    const nameMap = new Map<string, string | null>();
    (profiles ?? []).forEach((p) => {
      nameMap.set(String(p.id), (p.display_name as string | null) ?? null);
    });

    return authList.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      displayName: nameMap.get(u.id) ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      provider: (u.app_metadata?.provider as string | undefined) ?? "email",
      roles: roleMap.get(u.id) ?? [],
      banned: !!(u as { banned_until?: string | null }).banned_until,
    }));
  });

const SendResetInput = z.object({ email: z.string().email() });
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendResetInput.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as never);
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
    await ensureAdmin(context as never);
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
    await ensureAdmin(context as never);
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
