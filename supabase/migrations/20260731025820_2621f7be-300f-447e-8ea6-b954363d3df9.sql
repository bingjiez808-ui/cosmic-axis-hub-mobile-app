-- Human-reply grants: explicit claim + audit trail.

ALTER TABLE public.sage_reply_credits ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.sage_reply_credit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('grant','spend')),
  delta integer NOT NULL,
  letter_id uuid,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sage_reply_credit_events TO authenticated;
GRANT ALL ON public.sage_reply_credit_events TO service_role;
ALTER TABLE public.sage_reply_credit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own credit events readable" ON public.sage_reply_credit_events;
CREATE POLICY "own credit events readable"
  ON public.sage_reply_credit_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS sage_reply_credit_events_user_idx
  ON public.sage_reply_credit_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_sage_reply_credits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _tier text; _exp timestamptz; _row public.sage_reply_credits;
        _period date := date_trunc('month', now())::date; _entitled boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT membership_tier, membership_expires_at INTO _tier, _exp FROM public.profiles WHERE id = _uid;
  _entitled := COALESCE(_tier,'none') IN ('sage','oracle') AND _exp IS NOT NULL AND _exp > now();

  SELECT * INTO _row FROM public.sage_reply_credits WHERE user_id = _uid;
  IF NOT FOUND THEN
    INSERT INTO public.sage_reply_credits (user_id, granted, used, period_start)
    VALUES (_uid, 0, 0, _period) RETURNING * INTO _row;
  ELSIF _row.period_start < _period THEN
    UPDATE public.sage_reply_credits
       SET granted = 0, used = 0, period_start = _period, claimed_at = NULL
     WHERE user_id = _uid RETURNING * INTO _row;
  END IF;

  RETURN jsonb_build_object(
    'entitled', _entitled,
    'granted', _row.granted,
    'used', _row.used,
    'remaining', GREATEST(_row.granted - _row.used, 0),
    'claimable', _entitled AND _row.granted = 0,
    'claimedAt', _row.claimed_at,
    'periodStart', _row.period_start);
END; $function$;

REVOKE ALL ON FUNCTION public.get_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_sage_reply_credits() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_sage_reply_credits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _c jsonb; _period date := date_trunc('month', now())::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  _c := public.get_sage_reply_credits();
  IF NOT (_c->>'entitled')::boolean THEN
    RAISE EXCEPTION 'sage_required' USING ERRCODE = '42501';
  END IF;
  IF (_c->>'granted')::int > 0 THEN RETURN _c; END IF;

  UPDATE public.sage_reply_credits SET granted = 3, claimed_at = now() WHERE user_id = _uid;

  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta, period_start)
  VALUES (_uid, 'grant', 3, _period);

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.claim_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_sage_reply_credits() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_human_reply(_letter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _l record; _c jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.author_id <> _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  _c := public.get_sage_reply_credits();
  IF (_c->>'remaining')::int <= 0 THEN
    RAISE EXCEPTION 'no_human_reply_credits' USING ERRCODE = '53400';
  END IF;

  UPDATE public.sage_reply_credits SET used = used + 1 WHERE user_id = _uid;
  UPDATE public.community_letters SET route = 'librarian', updated_at = now() WHERE id = _letter_id;

  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta, letter_id)
  VALUES (_uid, 'spend', -1, _letter_id);

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.request_human_reply(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_human_reply(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sage_reply_credit_history()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'createdAt' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'eventId', e.id, 'kind', e.kind, 'delta', e.delta,
      'createdAt', e.created_at, 'periodStart', e.period_start,
      'letterId', e.letter_id,
      'letterSubject', l.subject,
      'letterPersonaId', l.persona_id,
      'letterStatus', l.status,
      'replyCount', (SELECT count(*) FROM public.community_letter_replies r
                      WHERE r.letter_id = e.letter_id AND r.status = 'approved')
    ) AS x
    FROM public.sage_reply_credit_events e
    LEFT JOIN public.community_letters l ON l.id = e.letter_id
    WHERE e.user_id = _uid
    ORDER BY e.created_at DESC
    LIMIT 60
  ) s;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_sage_reply_credit_history() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_sage_reply_credit_history() TO authenticated;