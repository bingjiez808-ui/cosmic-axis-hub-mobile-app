
-- Allow premium_pdf_reports to sit in `partial` state (budget stopped or
-- some chapters still failed after retries) so we never mark a report
-- "completed" when body text is missing.
ALTER TABLE public.premium_pdf_reports
  DROP CONSTRAINT IF EXISTS premium_pdf_reports_status_check;
ALTER TABLE public.premium_pdf_reports
  ADD CONSTRAINT premium_pdf_reports_status_check
  CHECK (status IN ('pending','generating','partial','completed','failed'));

-- Tighten admin_ai_usage_summary: revoke broad EXECUTE and RAISE for
-- non-admins so it's inaccessible to ordinary authenticated users.
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) TO service_role;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
    GROUP BY l.report_id, l.user_id
    ORDER BY MAX(l.created_at) DESC NULLS LAST;
END;
$$;

-- Atomic compare-and-swap for chapter claims. Called from the server
-- function before running a chapter. A lock is considered stale after
-- 5 minutes so a crashed worker can't wedge a chapter forever.
CREATE OR REPLACE FUNCTION public.claim_premium_chapter(
  _report_id UUID,
  _chapter_key TEXT,
  _chapter_index INTEGER,
  _new_token UUID,
  _lock_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _updated INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.premium_pdf_reports r
    WHERE r.id = _report_id AND r.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'not_report_owner' USING ERRCODE = '42501';
  END IF;

  -- Insert a fresh pending row if the chapter has no row yet.
  INSERT INTO public.premium_report_chapters
    (report_id, user_id, chapter_key, chapter_index, status, claim_token, claimed_at)
  VALUES
    (_report_id, _uid, _chapter_key, _chapter_index, 'running', _new_token, now())
  ON CONFLICT (report_id, chapter_key) DO NOTHING;

  -- Compare-and-swap: only take the claim when the row is pending or
  -- failed, and the existing claim_token is NULL or the previous claim
  -- expired.
  UPDATE public.premium_report_chapters
     SET status = 'running',
         claim_token = _new_token,
         claimed_at = now(),
         attempt_count = attempt_count + 1
   WHERE report_id = _report_id
     AND chapter_key = _chapter_key
     AND user_id = _uid
     AND status IN ('pending', 'failed')
     AND (
       claim_token IS NULL
       OR claimed_at IS NULL
       OR claimed_at < now() - make_interval(secs => _lock_ttl_seconds)
     );
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) TO service_role;

CREATE INDEX IF NOT EXISTS premium_report_chapters_claim_idx
  ON public.premium_report_chapters(claim_token, claimed_at)
  WHERE claim_token IS NOT NULL;
