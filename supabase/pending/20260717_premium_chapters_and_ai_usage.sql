-- ============================================================
-- PENDING MIGRATION — awaits user approval via supabase--migration tool.
-- Do NOT copy this file into supabase/migrations/ by hand; that folder
-- is managed by the migration system. When the user approves, the
-- agent will invoke the supabase--migration tool with this SQL.
--
-- Round 2 — Premium report chapter-level state + AI usage ledger.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.premium_report_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.premium_pdf_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_key TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  content_json JSONB,
  evidence_refs JSONB,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT premium_report_chapters_report_key_unique UNIQUE (report_id, chapter_key)
);

CREATE INDEX IF NOT EXISTS premium_report_chapters_report_idx
  ON public.premium_report_chapters(report_id, chapter_index);
CREATE INDEX IF NOT EXISTS premium_report_chapters_user_idx
  ON public.premium_report_chapters(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_report_chapters TO authenticated;
GRANT ALL ON public.premium_report_chapters TO service_role;

ALTER TABLE public.premium_report_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapter owner can read"
  ON public.premium_report_chapters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins can read all chapters"
  ON public.premium_report_chapters
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.premium_report_chapters_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'completed_chapter_immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_premium_report_chapters_guard
BEFORE UPDATE ON public.premium_report_chapters
FOR EACH ROW EXECUTE FUNCTION public.premium_report_chapters_guard();

CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.premium_pdf_reports(id) ON DELETE SET NULL,
  chapter_key TEXT,
  operation TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lovable-ai-gateway',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_credits NUMERIC(12,4),
  status TEXT NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok','error','budget_stopped','partial')),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_user_idx
  ON public.ai_usage_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_ledger_report_idx
  ON public.ai_usage_ledger(report_id);

GRANT SELECT ON public.ai_usage_ledger TO authenticated;
GRANT ALL ON public.ai_usage_ledger TO service_role;

ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger owner can read own"
  ON public.ai_usage_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins can read all ledger"
  ON public.ai_usage_ledger
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary(_since TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days')
RETURNS TABLE (
  report_id UUID,
  user_id UUID,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_credits NUMERIC,
  call_count BIGINT,
  last_call TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.report_id,
    l.user_id,
    SUM(l.input_tokens)::BIGINT,
    SUM(l.output_tokens)::BIGINT,
    COALESCE(SUM(l.estimated_credits), 0),
    COUNT(*)::BIGINT,
    MAX(l.created_at)
  FROM public.ai_usage_ledger l
  WHERE l.created_at >= _since
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY l.report_id, l.user_id
  ORDER BY MAX(l.created_at) DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) TO authenticated;

COMMIT;
