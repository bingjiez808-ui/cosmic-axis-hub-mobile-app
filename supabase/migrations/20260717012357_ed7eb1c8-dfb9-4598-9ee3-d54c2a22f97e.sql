CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.premium_pdf_reports
  ADD COLUMN IF NOT EXISTS input_hash text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS token_usage jsonb,
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS calculation_version text;

-- Best-effort back-fill of content_hash from stored JSON.
-- Note: this hashes the DB text serialization of content_json, not the
-- runtime canonical serialization, so legacy hashes may differ from
-- what the reading-engine would compute for the same content today.
-- That is expected — content_hash on legacy rows is audit metadata only
-- and never used as a cache lookup key.
UPDATE public.premium_pdf_reports
SET content_hash = encode(extensions.digest(content_json::text, 'sha256'), 'hex')
WHERE status = 'completed'
  AND content_json IS NOT NULL
  AND content_hash IS NULL;

-- Back-fill model_id from legacy model column so audit reads have a value.
UPDATE public.premium_pdf_reports
SET model_id = model
WHERE model_id IS NULL AND model IS NOT NULL;

-- Replace the (user_id, chart_id, report_version) unique constraint with
-- one that also includes input_hash. This lets a future prompt/model/
-- calculation upgrade insert a NEW row without overwriting the original
-- purchase. Legacy rows have input_hash IS NULL and are preserved
-- (Postgres treats NULLs as distinct in a unique index).
DROP INDEX IF EXISTS public.premium_pdf_reports_unique;
CREATE UNIQUE INDEX premium_pdf_reports_unique
  ON public.premium_pdf_reports (user_id, chart_id, report_version, input_hash);

CREATE INDEX IF NOT EXISTS premium_pdf_reports_cache_key_idx
  ON public.premium_pdf_reports (user_id, chart_id, input_hash);