-- Add cache/version columns to public.reports so the app can reuse
-- previously generated AI content instead of recomputing after an unlock.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS input_hash text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS token_usage jsonb;

-- Fast lookup for "same user + chart + kind + version + input" -> reuse.
CREATE INDEX IF NOT EXISTS reports_reuse_lookup_idx
  ON public.reports (user_id, chart_id, kind, report_version, input_hash);

-- Fast lookup for "same chart facts across users" (admins auditing regenerations).
CREATE INDEX IF NOT EXISTS reports_input_hash_idx
  ON public.reports (input_hash)
  WHERE input_hash IS NOT NULL;
