-- ── Batch B: dispatch waves, fairness, waiting state ─────────────

ALTER TABLE public.community_delivery_config
  ADD COLUMN IF NOT EXISTS second_wave integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS wave_interval_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS recipient_daily_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS waiting_hint_hours integer NOT NULL DEFAULT 12;

ALTER TABLE public.community_letters
  ADD COLUMN IF NOT EXISTS last_dispatch_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_wave integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS community_deliveries_recipient_day_idx
  ON public.community_letter_deliveries (recipient_id, delivered_at DESC);

-- ── dispatch: wave driven, fair, capped ──────────────────────────
CREATE OR REPLACE FUNCTION public.dispatch_community_letter(_letter_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _existing int; _approved int; _target int;
        _inserted int; _cfg record; _is_admin boolean; _max_recipients int; _interval int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.content_origin <> 'member' OR _l.author_id IS NULL THEN RETURN 0; END IF;

  _is_admin := private.has_role(_uid, 'admin'::public.app_role);
  IF _l.author_id <> _uid AND NOT _is_admin THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _l.status <> 'approved' THEN RETURN 0; END IF;
  IF _l.expires_at <= now() THEN RETURN 0; END IF;

  SELECT * INTO _cfg FROM public.community_delivery_config WHERE id = 1;
  _max_recipients := COALESCE(_cfg.max_recipients, 12);
  _interval := GREATEST(COALESCE(_cfg.wave_interval_hours, 24), 0);

  SELECT count(*) INTO _approved FROM public.community_letter_replies
   WHERE letter_id = _letter_id AND status = 'approved';
  IF _approved >= COALESCE(_cfg.max_replies, 3) THEN RETURN 0; END IF;

  SELECT count(*) INTO _existing FROM public.community_letter_deliveries WHERE letter_id = _letter_id;
  IF _existing >= _max_recipients THEN RETURN 0; END IF;

  -- wave gating: later waves only after the configured interval, and only
  -- while the letter is still waiting for its first replies.
  IF _l.dispatch_wave > 0 THEN
    IF _approved > 0 AND NOT _is_admin THEN RETURN 0; END IF;
    IF COALESCE(_l.last_dispatch_at, _l.created_at) > now() - make_interval(hours => _interval)
       AND NOT _is_admin THEN
      RETURN 0;
    END IF;
  END IF;

  _target := LEAST(
    _max_recipients - _existing,
    CASE WHEN _l.dispatch_wave = 0
         THEN GREATEST(COALESCE(_cfg.first_wave, 5), 1)
         ELSE GREATEST(COALESCE(_cfg.second_wave, 4), 1) END
  );
  IF _target <= 0 THEN RETURN 0; END IF;

  WITH pool AS (
    SELECT cp.user_id,
           (SELECT max(d.delivered_at) FROM public.community_letter_deliveries d
             WHERE d.recipient_id = cp.user_id) AS last_delivery,
           (SELECT count(*) FROM public.community_letter_deliveries d
             WHERE d.recipient_id = cp.user_id
               AND d.delivered_at > now() - interval '24 hours') AS today_count
      FROM public.community_profiles cp
     WHERE cp.opt_in = true
       AND cp.status = 'active'
       AND cp.age_band = _l.target_age_band
       AND cp.language = _l.language
       AND cp.user_id <> _l.author_id
       AND NOT EXISTS (SELECT 1 FROM public.community_letter_deliveries d
                        WHERE d.letter_id = _letter_id AND d.recipient_id = cp.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.community_blocks b
                        WHERE (b.blocker_id = _l.author_id AND b.blocked_user_id = cp.user_id)
                           OR (b.blocker_id = cp.user_id AND b.blocked_user_id = _l.author_id))
  ), eligible AS (
    SELECT user_id FROM pool
     WHERE today_count < GREATEST(COALESCE(_cfg.recipient_daily_cap, 3), 1)
     ORDER BY today_count ASC, last_delivery NULLS FIRST, random()
     LIMIT _target
  )
  INSERT INTO public.community_letter_deliveries (letter_id, recipient_id)
  SELECT _letter_id, user_id FROM eligible
  ON CONFLICT (letter_id, recipient_id) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted > 0 THEN
    UPDATE public.community_letters
       SET last_dispatch_at = now(), dispatch_wave = dispatch_wave + 1
     WHERE id = _letter_id;

    INSERT INTO public.community_notifications (user_id, type, entity_id)
    SELECT d.recipient_id, 'letter_received', _letter_id
      FROM public.community_letter_deliveries d
     WHERE d.letter_id = _letter_id AND d.delivered_at > now() - interval '5 seconds';
  END IF;

  RETURN _inserted;
END; $$;

REVOKE ALL ON FUNCTION public.dispatch_community_letter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_community_letter(uuid) TO authenticated, service_role;

-- ── waiting-state read model for the author ──────────────────────
CREATE OR REPLACE FUNCTION public.get_community_letter_dispatch_state(_letter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _cfg record; _delivered int; _replies int; _read int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.author_id <> _uid AND NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _cfg FROM public.community_delivery_config WHERE id = 1;
  SELECT count(*) INTO _delivered FROM public.community_letter_deliveries WHERE letter_id = _letter_id;
  SELECT count(*) INTO _read FROM public.community_letter_deliveries
   WHERE letter_id = _letter_id AND read_at IS NOT NULL;
  SELECT count(*) INTO _replies FROM public.community_letter_replies
   WHERE letter_id = _letter_id AND status = 'approved';

  RETURN jsonb_build_object(
    'letterId', _letter_id,
    'status', _l.status,
    'wave', _l.dispatch_wave,
    'deliveredCount', _delivered,
    'readCount', _read,
    'replyCount', _replies,
    'maxRecipients', COALESCE(_cfg.max_recipients, 12),
    'maxReplies', COALESCE(_cfg.max_replies, 3),
    'lastDispatchAt', _l.last_dispatch_at,
    'expiresAt', _l.expires_at,
    'nextWaveAt', CASE
      WHEN _l.dispatch_wave = 0 THEN NULL
      ELSE COALESCE(_l.last_dispatch_at, _l.created_at)
           + make_interval(hours => GREATEST(COALESCE(_cfg.wave_interval_hours, 24), 0))
    END,
    'canRequestWave', (
      _l.status = 'approved'
      AND _l.expires_at > now()
      AND _replies = 0
      AND _delivered < COALESCE(_cfg.max_recipients, 12)
      AND (_l.dispatch_wave = 0 OR COALESCE(_l.last_dispatch_at, _l.created_at)
            <= now() - make_interval(hours => GREATEST(COALESCE(_cfg.wave_interval_hours, 24), 0)))
    ),
    'waiting', (_l.status = 'approved' AND _replies = 0 AND _l.expires_at > now()),
    'waitingHintHours', COALESCE(_cfg.waiting_hint_hours, 12)
  );
END; $$;

REVOKE ALL ON FUNCTION public.get_community_letter_dispatch_state(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_community_letter_dispatch_state(uuid) TO authenticated, service_role;