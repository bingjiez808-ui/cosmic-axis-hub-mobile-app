BEGIN;

CREATE TABLE IF NOT EXISTS public.year_readings_v1 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL REFERENCES public.charts(id) ON DELETE CASCADE,
  facts_hash TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh' CHECK (lang IN ('zh','en')),
  year INTEGER NOT NULL,
  age INTEGER NOT NULL,
  system_scores JSONB NOT NULL,
  composite_score INTEGER,
  composite_direction TEXT CHECK (composite_direction IN ('up','stable','down')),
  composite_confidence TEXT CHECK (composite_confidence IN ('reference_only','low','mid','high')),
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  interpretation JSONB NOT NULL,
  advice JSONB NOT NULL,
  unavailable_systems JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT year_readings_v1_unique
    UNIQUE (chart_id, facts_hash, calculation_version, skill_version, lang, year)
);

CREATE INDEX IF NOT EXISTS year_readings_v1_owner_chart_idx
  ON public.year_readings_v1 (owner_id, chart_id, year);
CREATE INDEX IF NOT EXISTS year_readings_v1_facts_idx
  ON public.year_readings_v1 (chart_id, facts_hash, skill_version, lang);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.year_readings_v1 TO authenticated;
GRANT ALL ON public.year_readings_v1 TO service_role;

ALTER TABLE public.year_readings_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "year_readings owner can read"
  ON public.year_readings_v1 FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "year_readings owner can insert"
  ON public.year_readings_v1 FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "year_readings owner can update"
  ON public.year_readings_v1 FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "year_readings owner can delete"
  ON public.year_readings_v1 FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "admins can read all year_readings"
  ON public.year_readings_v1 FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;