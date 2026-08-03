import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getChartById,
  listUserCharts,
  type ChartRow,
} from "@/lib/reports-store.functions";
import { useSupabaseSession } from "@/lib/session";
import type { GateState } from "@/experiences/life-studies/MainChartGate";

type ChartDetail = Awaited<ReturnType<typeof getChartById>>;

export type PrimaryChartForStudies = {
  loading: boolean;
  isSignedIn: boolean;
  primary: ChartRow | null;
  detail: ChartDetail | null;
  gate: GateState;
};

export function usePrimaryChartForStudies(returnTo: string): PrimaryChartForStudies {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [state, setState] = useState<PrimaryChartForStudies>({
    loading: true,
    isSignedIn: false,
    primary: null,
    detail: null,
    gate: { kind: "loading" },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((prev) => ({ ...prev, loading: true, gate: { kind: "loading" } }));
      if (sessionLoading) return;

      let activeSession = session;
      if (!activeSession) {
        const { data } = await supabase.auth.getSession();
        activeSession = data.session ?? null;
      }

      if (!activeSession) {
        if (!cancelled) {
          setState({
            loading: false,
            isSignedIn: false,
            primary: null,
            detail: null,
            gate: { kind: "signed-out", returnTo },
          });
        }
        return;
      }

      try {
        const charts = await listUserCharts();
        const primary =
          charts.find((c) => c.is_primary && c.chart_role === "self") ??
          charts.find((c) => c.chart_role === "self") ??
          charts[0] ??
          null;
        if (!primary) {
          if (!cancelled) {
            setState({
              loading: false,
              isSignedIn: true,
              primary: null,
              detail: null,
              gate: { kind: "no-primary" },
            });
          }
          return;
        }

        const detail = await getChartById({ data: { chartId: primary.id } });
        if (!cancelled) {
          setState({
            loading: false,
            isSignedIn: true,
            primary,
            detail,
            gate: {
              kind: "ready",
              chartName: primary.name ?? null,
              birthDate: primary.birth_date ?? null,
              birthPlace: primary.birth_place ?? null,
            },
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            isSignedIn: true,
            primary: null,
            detail: null,
            gate: { kind: "no-primary" },
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [returnTo, session, sessionLoading]);

  return state;
}
