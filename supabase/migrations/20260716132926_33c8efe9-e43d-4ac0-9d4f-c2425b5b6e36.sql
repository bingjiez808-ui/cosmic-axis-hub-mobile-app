-- Charts: one row per user × normalized birth input.
CREATE TABLE IF NOT EXISTS public.charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  birth_date TEXT,
  birth_time TEXT,
  birth_place TEXT,
  lang TEXT,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_input_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_input_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.charts TO authenticated;
GRANT ALL ON public.charts TO service_role;

ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charts_owner_select" ON public.charts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "charts_owner_insert" ON public.charts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "charts_owner_update" ON public.charts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "charts_owner_delete" ON public.charts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reports: pending/completed/failed generation records tied to a chart.
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL REFERENCES public.charts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- 'report' | 'outlook'
  report_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | failed
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_json JSONB,
  model TEXT,
  provider TEXT,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chart_id, kind, report_version)
);

-- Users may only READ their own reports through the Data API.
-- All writes go through service-role server functions to prevent
-- clients from forging a `completed` status or `report_json`.
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_owner_select" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Shared updated_at trigger.
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS charts_set_updated_at ON public.charts;
CREATE TRIGGER charts_set_updated_at BEFORE UPDATE ON public.charts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS reports_set_updated_at ON public.reports;
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

CREATE INDEX IF NOT EXISTS charts_user_created_idx ON public.charts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_chart_kind_idx ON public.reports (user_id, chart_id, kind, report_version);
