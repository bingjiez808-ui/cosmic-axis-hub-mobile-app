-- 1. Human-reply credits: one-time lifetime grant of 3 (not monthly).

CREATE OR REPLACE FUNCTION public.get_sage_reply_credits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _tier text; _exp timestamptz; _row public.sage_reply_credits;
        _entitled boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT membership_tier, membership_expires_at INTO _tier, _exp FROM public.profiles WHERE id = _uid;
  _entitled := COALESCE(_tier,'none') IN ('sage','oracle') AND _exp IS NOT NULL AND _exp > now();

  SELECT * INTO _row FROM public.sage_reply_credits WHERE user_id = _uid;
  IF NOT FOUND THEN
    INSERT INTO public.sage_reply_credits (user_id, granted, used, period_start)
    VALUES (_uid, 0, 0, date_trunc('month', now())::date) RETURNING * INTO _row;
  END IF;

  RETURN jsonb_build_object(
    'entitled', _entitled,
    'lifetime', true,
    'granted', _row.granted,
    'used', _row.used,
    'remaining', GREATEST(_row.granted - _row.used, 0),
    'claimable', _entitled AND _row.claimed_at IS NULL AND _row.granted = 0,
    'claimedAt', _row.claimed_at,
    'periodStart', _row.period_start);
END; $function$;

REVOKE ALL ON FUNCTION public.get_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_sage_reply_credits() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_sage_reply_credits()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _c jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  _c := public.get_sage_reply_credits();
  IF NOT (_c->>'entitled')::boolean THEN
    RAISE EXCEPTION 'sage_required' USING ERRCODE = '42501';
  END IF;
  IF NOT (_c->>'claimable')::boolean THEN RETURN _c; END IF;

  UPDATE public.sage_reply_credits
     SET granted = granted + 3, claimed_at = now()
   WHERE user_id = _uid;

  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta)
  VALUES (_uid, 'grant', 3);

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.claim_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_sage_reply_credits() TO authenticated;

-- 2. Ratings on human echoes.

CREATE TABLE IF NOT EXISTS public.community_reply_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL REFERENCES public.community_letter_replies(id) ON DELETE CASCADE,
  letter_id uuid NOT NULL REFERENCES public.community_letters(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  helper_id uuid,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, rater_id)
);

GRANT SELECT ON public.community_reply_ratings TO authenticated;
GRANT ALL ON public.community_reply_ratings TO service_role;
ALTER TABLE public.community_reply_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own ratings readable" ON public.community_reply_ratings;
CREATE POLICY "own ratings readable"
  ON public.community_reply_ratings FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR helper_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS community_reply_ratings_helper_idx
  ON public.community_reply_ratings (helper_id, created_at DESC);

-- 3. Helper rewards ledger.

CREATE TABLE IF NOT EXISTS public.community_helper_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward text NOT NULL DEFAULT 'oracle_month',
  rated_count integer NOT NULL DEFAULT 0,
  avg_stars numeric(3,2),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_helper_rewards TO authenticated;
GRANT ALL ON public.community_helper_rewards TO service_role;
ALTER TABLE public.community_helper_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rewards readable" ON public.community_helper_rewards;
CREATE POLICY "own rewards readable"
  ON public.community_helper_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS community_helper_rewards_user_idx
  ON public.community_helper_rewards (user_id, created_at DESC);

-- 4. Rate a human echo; evaluate the helper reward in the same transaction.

CREATE OR REPLACE FUNCTION public.rate_letter_reply(_reply_id uuid, _stars smallint, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _r record; _letter record; _helper uuid;
        _rated int; _avg numeric; _high int; _last timestamptz; _rewarded boolean := false;
        _tier text; _exp timestamptz; _new_exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _stars IS NULL OR _stars < 1 OR _stars > 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _r FROM public.community_letter_replies WHERE id = _reply_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reply_not_found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _letter FROM public.community_letters WHERE id = _r.letter_id;
  IF _letter.author_id <> _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF _r.author_kind = 'sage' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  _helper := _r.author_id;

  INSERT INTO public.community_reply_ratings (reply_id, letter_id, rater_id, helper_id, stars, note)
  VALUES (_reply_id, _r.letter_id, _uid, _helper, _stars, NULLIF(btrim(COALESCE(_note,'')), ''))
  ON CONFLICT (reply_id, rater_id) DO NOTHING;

  IF _helper IS NOT NULL THEN
    SELECT count(*), avg(stars), count(*) FILTER (WHERE stars >= 4)
      INTO _rated, _avg, _high
      FROM public.community_reply_ratings WHERE helper_id = _helper;

    SELECT max(created_at) INTO _last FROM public.community_helper_rewards WHERE user_id = _helper;

    IF _rated >= 3 AND _avg >= 4.5 AND _high >= 3
       AND (_last IS NULL OR _last < now() - interval '30 days') THEN
      SELECT membership_tier, membership_expires_at INTO _tier, _exp FROM public.profiles WHERE id = _helper;
      _new_exp := GREATEST(COALESCE(_exp, now()), now()) + interval '30 days';
      UPDATE public.profiles
         SET membership_tier = CASE WHEN COALESCE(_tier,'none') = 'oracle' THEN 'oracle' ELSE 'oracle' END,
             membership_expires_at = _new_exp
       WHERE id = _helper;
      INSERT INTO public.community_helper_rewards (user_id, reward, rated_count, avg_stars, expires_at)
      VALUES (_helper, 'oracle_month', _rated, round(_avg, 2), _new_exp);
      _rewarded := true;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'stars', _stars, 'helperRewarded', _rewarded);
END; $function$;

REVOKE ALL ON FUNCTION public.rate_letter_reply(uuid, smallint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rate_letter_reply(uuid, smallint, text) TO authenticated;

-- 5. My ratings given + my helper standing.

CREATE OR REPLACE FUNCTION public.get_my_reply_ratings()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_object_agg(reply_id::text, jsonb_build_object('stars', stars, 'note', note)), '{}'::jsonb)
    INTO _out FROM public.community_reply_ratings WHERE rater_id = _uid;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_my_reply_ratings() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reply_ratings() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_helper_standing()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _rated int; _avg numeric; _high int; _rewards jsonb; _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT count(*), avg(stars), count(*) FILTER (WHERE stars >= 4)
    INTO _rated, _avg, _high FROM public.community_reply_ratings WHERE helper_id = _uid;
  SELECT max(created_at) INTO _last FROM public.community_helper_rewards WHERE user_id = _uid;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'rewardId', id, 'reward', reward, 'ratedCount', rated_count,
      'avgStars', avg_stars, 'expiresAt', expires_at, 'createdAt', created_at
    ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO _rewards FROM public.community_helper_rewards WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'ratedCount', COALESCE(_rated, 0),
    'avgStars', COALESCE(round(_avg, 2), 0),
    'highCount', COALESCE(_high, 0),
    'needRated', 3, 'needAvg', 4.5, 'needHigh', 3,
    'cooldownUntil', CASE WHEN _last IS NULL THEN NULL ELSE _last + interval '30 days' END,
    'rewards', _rewards);
END; $function$;

REVOKE ALL ON FUNCTION public.get_helper_standing() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_helper_standing() TO authenticated;