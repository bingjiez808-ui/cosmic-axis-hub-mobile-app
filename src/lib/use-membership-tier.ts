import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * useMembershipTier — the single UI hook for reading the caller's
 * effective monthly-membership tier from `profiles.membership_tier`.
 *
 * Fail-closed: any error, missing row, or expired `membership_expires_at`
 * downgrades to "none". The one-time ¥79 premium report is NOT modelled
 * here — that is a separate per-chart entitlement.
 */

export type MemTier = "none" | "sage" | "oracle";

export type MembershipState =
  | { kind: "loading" }
  | { kind: "anon" }
  | {
      kind: "ready";
      tier: MemTier;
      /** raw db tier — may be `sage`/`oracle` even when expired */
      rawTier: MemTier;
      expiresAt: string | null;
      active: boolean;
    };

// Cross-component refresh signal. `refreshMembershipTier()` triggers
// every mounted `useMembershipTier` to reload — used after a successful
// in-place membership checkout so gated views unlock without a route change.
const listeners = new Set<() => void>();

export async function refreshMembershipTier(): Promise<void> {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function useMembershipTier(): MembershipState {
  const [state, setState] = useState<MembershipState>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session) {
        setState({ kind: "anon" });
        return;
      }
      try {
        const { data } = await supabase
          .from("profiles")
          .select("membership_tier, membership_expires_at")
          .eq("id", sess.session.user.id)
          .maybeSingle();
        if (cancelled) return;
        const raw = (data?.membership_tier ?? "none") as string;
        const rawTier: MemTier =
          raw === "sage" || raw === "oracle" ? raw : "none";
        const exp = (data?.membership_expires_at as string | null) ?? null;
        const expTs = exp ? new Date(exp).getTime() : null;
        const active =
          rawTier !== "none" && !!expTs && !Number.isNaN(expTs) && expTs > Date.now();
        setState({
          kind: "ready",
          tier: active ? rawTier : "none",
          rawTier,
          expiresAt: exp,
          active,
        });
      } catch {
        if (!cancelled)
          setState({ kind: "ready", tier: "none", rawTier: "none", expiresAt: null, active: false });
      }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [nonce]);

  return state;
}

/** Rank helper — Oracle strictly inherits Sage. */
export function tierRank(t: MemTier): number {
  return t === "oracle" ? 2 : t === "sage" ? 1 : 0;
}

export function hasSageAccess(t: MemTier): boolean {
  return tierRank(t) >= 1;
}
export function hasOracleAccess(t: MemTier): boolean {
  return tierRank(t) >= 2;
}
