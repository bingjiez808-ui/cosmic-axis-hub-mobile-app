import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin server functions. Every handler:
 *   1. Runs `requireSupabaseAuth` (verified Supabase session).
 *   2. Re-verifies admin role via `has_role()` before touching admin data.
 *   3. Lazy-imports the service-role client (module is never bundled to the browser).
 */

async function ensureAdmin(context: { supabase: ReturnType<typeof getSupabaseType>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Failed to verify admin role");
  if (!data) throw new Error("Forbidden: admin role required");
}
// type helper only — never called
function getSupabaseType() {
  return null as unknown as { rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: unknown }> };
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

    const ids = authList.users.map((u) => u.id);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });
    const nameMap = new Map<string, string | null>();
    (profiles ?? []).forEach((p) => nameMap.set(p.id, (p as { display_name: string | null }).display_name));

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
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.displayName, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
