CREATE OR REPLACE FUNCTION public.claim_premium_chapter(_report_id uuid, _chapter_key text, _chapter_index integer, _new_token uuid, _lock_ttl_seconds integer DEFAULT 120)
RETURNS boolean
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
    SELECT 1
    FROM public.premium_pdf_reports r
    WHERE r.id = _report_id
      AND r.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'not_report_owner' USING ERRCODE = '42501';
  END IF;

  -- First-time claim: create the row already running and count this attempt.
  INSERT INTO public.premium_report_chapters
    (report_id, user_id, chapter_key, chapter_index, status, attempt_count, claim_token, claimed_at, error_message)
  VALUES
    (_report_id, _uid, _chapter_key, _chapter_index, 'running', 1, _new_token, now(), NULL)
  ON CONFLICT (report_id, chapter_key) DO NOTHING;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated > 0 THEN
    RETURN true;
  END IF;

  -- Existing rows: claim pending/failed rows, or recycle stale running rows.
  UPDATE public.premium_report_chapters
     SET status = 'running',
         claim_token = _new_token,
         claimed_at = now(),
         attempt_count = CASE
           WHEN status = 'running' THEN attempt_count
           ELSE attempt_count + 1
         END,
         error_message = NULL
   WHERE report_id = _report_id
     AND chapter_key = _chapter_key
     AND user_id = _uid
     AND (
       status IN ('pending', 'failed')
       OR (
         status = 'running'
         AND (
           claimed_at IS NULL
           OR claimed_at < now() - make_interval(secs => _lock_ttl_seconds)
         )
       )
     )
     AND attempt_count < 3
     AND (
       claim_token IS NULL
       OR claimed_at IS NULL
       OR claimed_at < now() - make_interval(secs => _lock_ttl_seconds)
     );
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;