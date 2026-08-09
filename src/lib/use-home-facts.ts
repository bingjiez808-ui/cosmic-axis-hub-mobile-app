/**
 * useHomeFacts — single source of truth for the home page seven-card
 * CTA resolver. Combines auth session, primary-chart existence and
 * membership tier so we don't duplicate that fetching logic per card.
 */
import { useEffect, useState } from "react";
import { useSupabaseSession } from "@/lib/session";
import { useMembershipTier, type MemTier } from "@/lib/use-membership-tier";
import { listUserCharts } from "@/lib/reports-store.functions";

export type HomeFacts = {
  isSignedIn: boolean;
  hasPrimaryChart: boolean;
  tier: MemTier;
  chartsLoading: boolean;
};

export function useHomeFacts(): HomeFacts {
  const { session } = useSupabaseSession();
  const isSignedIn = !!session;
  const membership = useMembershipTier();
  const tier: MemTier =
    membership.kind === "ready" ? membership.tier : "none";
  const [hasPrimaryChart, setHasPrimaryChart] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setHasPrimaryChart(false);
      return;
    }
    let cancelled = false;
    setChartsLoading(true);
    (async () => {
      try {
        const rows = await listUserCharts();
        if (!cancelled) setHasPrimaryChart(rows.some((c) => c.is_primary));
      } catch {
        if (!cancelled) setHasPrimaryChart(false);
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  return { isSignedIn, hasPrimaryChart, tier, chartsLoading };
}
