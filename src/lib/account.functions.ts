import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "./rate-limit.server";
import { safeMessage } from "./ai-guardrails";

/**
 * Permanently deletes the caller's own account and personal data.
 *
 * Security notes:
 *   - Requires `requireSupabaseAuth` — the caller's identity comes from the
 *     verified bearer token, not from any client field.
 *   - The client must also echo back its own email as a soft confirmation
 *     phrase; a stale/misdirected form cannot delete the wrong account.
 *   - A short in-memory rate-limit prevents accidental double-submit and
 *     scripted deletion floods.
 *   - Best-effort cleanup: individual table failures are logged (with no
 *     personal fields) and the auth user is still deleted at the end so an
 *     obscure missing table cannot leave a live auth account behind.
 *
 * Requirements at runtime:
 *   - `SUPABASE_SERVICE_ROLE_KEY` on the server (already configured on
 *     Lovable Cloud). The service-role client is loaded inside the handler
 *     so it never enters the client bundle.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        confirmEmail: z.string().trim().email().max(320),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    enforceRateLimit(`delete-account:${userId}`, 3, 5 * 60_000, "account deletions");

    const claimedEmail = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!claimedEmail || claimedEmail !== data.confirmEmail.trim().toLowerCase()) {
      // Same message regardless of which check failed, to avoid oracle behaviour.
      throw new Error("Confirmation email does not match the signed-in account");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tables that carry a `user_id` we own. Add new tables here as they land.
    const userIdTables = [
      "user_feedback",
      "user_activity",
      "tarot_usage",
      "user_roles",
    ];

    // Fire deletes in parallel; capture failures without aborting the flow.
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    };
    const results = await Promise.allSettled(
      userIdTables.map((t) => admin.from(t).delete().eq("user_id", userId)),
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[deleteMyAccount] table=${userIdTables[i]} threw`);
      } else if (r.value?.error) {
        console.error(`[deleteMyAccount] table=${userIdTables[i]} error=${r.value.error.message}`);
      }
    });

    // profiles is keyed by `id`, not `user_id`.
    try {
      const { error } = await admin.from("profiles").delete().eq("id", userId);
      if (error) console.error(`[deleteMyAccount] profiles error=${error.message}`);
    } catch (err) {
      console.error("[deleteMyAccount] profiles threw", err instanceof Error ? err.message : "");
    }

    // NOTE: no `community_posts` table today. When community moves to the DB
    // add its cleanup here (delete-own + best-effort anonymise where retained
    // by policy).

    // Finally, remove the auth user. This is the load-bearing step: if
    // everything else failed but this succeeds, the account is inaccessible.
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw new Error(safeMessage(error, "Deletion failed"));
    } catch (err) {
      throw new Error(safeMessage(err, "Deletion failed"));
    }

    // A non-identifying audit line so ops can see delete throughput without
    // storing anything about the deleted account. Do NOT log email/user id.
    console.info(`[deleteMyAccount] ok ts=${Date.now()}`);

    return { ok: true as const };
  });
