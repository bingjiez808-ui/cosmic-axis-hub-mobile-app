ALTER TABLE public.premium_report_chapters
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS confidence TEXT;