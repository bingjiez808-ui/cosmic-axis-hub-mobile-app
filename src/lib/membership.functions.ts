/**
 * Membership server functions — the single write path for monthly
 * reading-room memberships (Sage / Oracle). Runs on the server with
 * `requireSupabaseAuth` middleware so ownership is derived from the
 * caller's session, never from the request body.
 *
 * The atomic work happens in the DB RPC `simulate_mock_membership_upgrade`
 * (order insert + profile tier/expiry update in one transaction; guarded
 * so client-side updates to `membership_*` columns are blocked).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MembershipUpgradeResult = {
  idempotent: boolean;
  order: {
    id: string;
    target_tier: "sage" | "oracle";
    amount_cents: number;
    currency: string;
    payment_method: string;
    provider: string;
    status: string;
    previous_tier: string;
    granted_started_at: string;
    granted_expires_at: string;
    created_at: string;
  };
  membership: {
    tier: "none" | "sage" | "oracle";
    expires_at: string | null;
    started_at: string | null;
  };
};

const UpgradeInput = z.object({
  targetTier: z.enum(["sage", "oracle"]),
  paymentMethod: z.enum(["wechat", "alipay", "visa", "unionpay"]),
  idempotencyKey: z.string().min(8).max(80),
});

export const simulateMockMembershipUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpgradeInput.parse(data))
  .handler(async ({ data, context }): Promise<MembershipUpgradeResult> => {
    const supabase = (context as { supabase: unknown }).supabase as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
    };
    const { data: raw, error } = await supabase.rpc("simulate_mock_membership_upgrade", {
      _target_tier: data.targetTier,
      _payment_method: data.paymentMethod,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) {
      const msg = error.message || "membership_upgrade_failed";
      throw new Error(msg);
    }
    return raw as MembershipUpgradeResult;
  });

/**
 * List the caller's monthly-membership orders (RLS-scoped).
 * Ordered newest first.
 */
export const listMyMembershipOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as { supabase: unknown }).supabase as {
      from: (t: string) => {
        select: (c: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await supabase
      .from("membership_orders")
      .select(
        "id, target_tier, amount_cents, currency, payment_method, status, granted_started_at, granted_expires_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<{
      id: string;
      target_tier: "sage" | "oracle";
      amount_cents: number;
      currency: string;
      payment_method: string;
      status: string;
      granted_started_at: string;
      granted_expires_at: string;
      created_at: string;
    }>) ?? [];
  });
