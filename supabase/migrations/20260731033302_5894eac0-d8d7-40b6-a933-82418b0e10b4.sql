
ALTER TABLE public.sage_reply_credits
  ADD COLUMN IF NOT EXISTS sage_granted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sage_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.sage_reply_credit_events
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.sage_reply_credit_events DROP CONSTRAINT IF EXISTS sage_reply_credit_events_kind_check;
ALTER TABLE public.sage_reply_credit_events
  ADD CONSTRAINT sage_reply_credit_events_kind_check CHECK (kind IN ('grant','spend','purchase'));
ALTER TABLE public.sage_reply_credit_events DROP CONSTRAINT IF EXISTS sage_reply_credit_events_bucket_check;
ALTER TABLE public.sage_reply_credit_events
  ADD CONSTRAINT sage_reply_credit_events_bucket_check CHECK (bucket IN ('human','sage'));

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
    'sageGranted', _row.sage_granted,
    'sageUsed', _row.sage_used,
    'sageRemaining', GREATEST(_row.sage_granted - _row.sage_used, 0),
    'claimable', _entitled AND _row.claimed_at IS NULL,
    'claimedAt', _row.claimed_at,
    'periodStart', _row.period_start);
END; $function$;

REVOKE ALL ON FUNCTION public.get_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_sage_reply_credits() TO authenticated;

-- Joining 贤者 grants once: 2 sage replies + 1 librarian-authorised human reply.
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
     SET granted = granted + 1, sage_granted = sage_granted + 2, claimed_at = now()
   WHERE user_id = _uid;

  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta, bucket)
  VALUES (_uid, 'grant', 2, 'sage'), (_uid, 'grant', 1, 'human');

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.claim_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_sage_reply_credits() TO authenticated;

-- Spend one 先贤回信 credit for a letter the caller authored.
CREATE OR REPLACE FUNCTION public.spend_sage_reply_credit(_letter_id uuid)
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
  IF (_c->>'sageRemaining')::int <= 0 THEN
    RAISE EXCEPTION 'no_sage_reply_credits' USING ERRCODE = '53400';
  END IF;

  UPDATE public.sage_reply_credits SET sage_used = sage_used + 1 WHERE user_id = _uid;
  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta, letter_id, bucket)
  VALUES (_uid, 'spend', -1, _letter_id, 'sage');

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.spend_sage_reply_credit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_sage_reply_credit(uuid) TO authenticated;

-- Top-up packs: ¥3 for one reply, ¥10 for four.
CREATE TABLE IF NOT EXISTS public.reply_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('human','sage')),
  pack text NOT NULL CHECK (pack IN ('single','quad')),
  quantity integer NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

GRANT SELECT ON public.reply_credit_orders TO authenticated;
GRANT ALL ON public.reply_credit_orders TO service_role;
ALTER TABLE public.reply_credit_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own reply credit orders readable" ON public.reply_credit_orders;
CREATE POLICY "own reply credit orders readable"
  ON public.reply_credit_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.purchase_reply_credits(_bucket text, _pack text, _idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _qty int; _cents int; _existing public.reply_credit_orders;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _bucket NOT IN ('human','sage') THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF _pack = 'single' THEN _qty := 1; _cents := 300;
  ELSIF _pack = 'quad' THEN _qty := 4; _cents := 1000;
  ELSE RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF COALESCE(btrim(_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _existing FROM public.reply_credit_orders
   WHERE user_id = _uid AND idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN public.get_sage_reply_credits(); END IF;

  INSERT INTO public.reply_credit_orders (user_id, bucket, pack, quantity, amount_cents, idempotency_key)
  VALUES (_uid, _bucket, _pack, _qty, _cents, _idempotency_key);

  PERFORM public.get_sage_reply_credits();
  IF _bucket = 'sage' THEN
    UPDATE public.sage_reply_credits SET sage_granted = sage_granted + _qty WHERE user_id = _uid;
  ELSE
    UPDATE public.sage_reply_credits SET granted = granted + _qty WHERE user_id = _uid;
  END IF;

  INSERT INTO public.sage_reply_credit_events (user_id, kind, delta, bucket, amount_cents)
  VALUES (_uid, 'purchase', _qty, _bucket, _cents);

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.purchase_reply_credits(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_reply_credits(text, text, text) TO authenticated;

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
      'bucket', e.bucket, 'amountCents', e.amount_cents,
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
