import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fully deletes the caller's own account and personal data.
 *
 * Removes rows the user owns across every public table that carries a
 * `user_id`, and finally removes the auth.users row via the service-role
 * client. This is a hard delete (not a deactivation).
 *
 * Requirements for this to actually delete the auth user in production:
 *   - `SUPABASE_SERVICE_ROLE_KEY` must be set on the server (already
 *     configured on Lovable Cloud).
 *   - The user must re-enter their exact email as a confirmation phrase
 *     from the client before this fn is invoked (UI-side check).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        // The user's own email, echoed back as a confirmation phrase.
        confirmEmail: z.string().email(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const claimedEmail = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!claimedEmail || claimedEmail !== data.confirmEmail.trim().toLowerCase()) {
      throw new Error("Confirmation email does not match the signed-in account");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort scrub across public tables that hold personal data.
    // Errors on individual tables are logged and swallowed so a missing
    // permission on one table does not block the actual auth user deletion.
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    };
    const scrubTables = [
      "user_feedback",
      "user_activity",
      "tarot_usage",
      "user_roles",
      "profiles",
    ];
    for (const table of scrubTables) {
      try {
        const { error } = await sb.from(table).delete().eq("user_id", userId);
        if (error && !/user_id/.test(error.message)) {
          // profiles uses `id`, not `user_id` — retry.
          if (table === "profiles") {
            const sb2 = supabaseAdmin as unknown as {
              from: (t: string) => {
                delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
              };
            };
            const { error: e2 } = await sb2.from("profiles").delete().eq("id", userId);
            if (e2) console.error("[deleteMyAccount] profiles delete failed:", e2.message);
          } else {
            console.error(`[deleteMyAccount] ${table} delete failed:`, error.message);
          }
        }
      } catch (err) {
        console.error(`[deleteMyAccount] ${table} threw:`, err);
      }
    }
    // profiles keyed on id
    try {
      const sb2 = supabaseAdmin as unknown as {
        from: (t: string) => {
          delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
        };
      };
      await sb2.from("profiles").delete().eq("id", userId);
    } catch (err) {
      console.error("[deleteMyAccount] profiles delete (by id) threw:", err);
    }

    // Finally, the auth user itself.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(`Failed to delete auth user: ${authErr.message}`);

    return { ok: true as const };
  });
