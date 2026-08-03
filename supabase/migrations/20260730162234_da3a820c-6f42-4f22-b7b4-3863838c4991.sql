-- ── 1. letters: provenance + risk ────────────────────────────────
ALTER TABLE public.community_letters
  ADD COLUMN IF NOT EXISTS content_origin text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.community_letters ALTER COLUMN author_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_origin_chk
    CHECK (content_origin IN ('member','library_sample'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_risk_chk
    CHECK (risk_level IN ('none','review','crisis'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_author_origin_chk
    CHECK ((content_origin = 'library_sample' AND author_id IS NULL)
        OR (content_origin = 'member' AND author_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_letters_sample_idx
  ON public.community_letters (content_origin, language, published_at DESC);
CREATE INDEX IF NOT EXISTS community_letters_risk_idx
  ON public.community_letters (risk_level, status, created_at DESC);

DROP POLICY IF EXISTS community_letters_select_samples ON public.community_letters;
CREATE POLICY community_letters_select_samples ON public.community_letters
  FOR SELECT TO authenticated
  USING (content_origin = 'library_sample' AND status = 'approved' AND published_at IS NOT NULL);

-- ── 2. reports: triage priority ──────────────────────────────────
ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
DO $$ BEGIN
  ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_priority_chk
    CHECK (priority IN ('normal','high','crisis'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS community_reports_priority_idx
  ON public.community_reports (priority, status, created_at DESC);

-- ── 3. delivery configuration (single row, admin editable) ───────
CREATE TABLE IF NOT EXISTS public.community_delivery_config (
  id smallint PRIMARY KEY DEFAULT 1,
  max_recipients smallint NOT NULL DEFAULT 12,
  first_wave smallint NOT NULL DEFAULT 5,
  daily_letter_limit smallint NOT NULL DEFAULT 3,
  max_replies smallint NOT NULL DEFAULT 3,
  letter_ttl_days smallint NOT NULL DEFAULT 14,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_delivery_config_singleton CHECK (id = 1),
  CONSTRAINT community_delivery_config_range CHECK (
    max_recipients BETWEEN 1 AND 50 AND first_wave BETWEEN 1 AND 50
    AND daily_letter_limit BETWEEN 1 AND 20 AND max_replies BETWEEN 1 AND 20
    AND letter_ttl_days BETWEEN 1 AND 90)
);

INSERT INTO public.community_delivery_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.community_delivery_config TO authenticated;
GRANT ALL ON public.community_delivery_config TO service_role;
ALTER TABLE public.community_delivery_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_delivery_config_read ON public.community_delivery_config;
CREATE POLICY community_delivery_config_read ON public.community_delivery_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS community_delivery_config_admin ON public.community_delivery_config;
CREATE POLICY community_delivery_config_admin ON public.community_delivery_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 4. send: risk aware ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.send_community_letter(text,text,text,text,text,boolean);

CREATE OR REPLACE FUNCTION public.send_community_letter(
  _subject text,
  _body text,
  _topic text,
  _target_age_band text,
  _response_style text,
  _needs_review boolean DEFAULT false,
  _risk_level text DEFAULT 'none'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _band text; _lang text; _sent int; _id uuid; _dup int;
        _cfg record; _risk text := COALESCE(NULLIF(btrim(_risk_level),''),'none');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _risk NOT IN ('none','review','crisis') THEN _risk := 'none'; END IF;
  _band := public.community_age_band(_uid);
  IF _band IS NULL THEN RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501'; END IF;
  IF _target_age_band NOT IN ('18-22','23-29','30-39','40-49','50-59','60+') THEN
    RAISE EXCEPTION 'invalid_target_age_band' USING ERRCODE = '22023';
  END IF;
  _body := btrim(_body);
  IF length(_body) < 20 OR length(_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body_length' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _cfg FROM public.community_delivery_config WHERE id = 1;

  SELECT count(*) INTO _sent FROM public.community_letters
   WHERE author_id = _uid AND created_at > now() - interval '1 day';
  IF _sent >= COALESCE(_cfg.daily_letter_limit, 3) THEN
    RAISE EXCEPTION 'daily_letter_limit' USING ERRCODE = '53400';
  END IF;

  SELECT count(*) INTO _dup FROM public.community_letters
   WHERE author_id = _uid AND body = _body AND created_at > now() - interval '10 minutes';
  IF _dup > 0 THEN RAISE EXCEPTION 'duplicate_submission' USING ERRCODE = '53400'; END IF;

  SELECT COALESCE(language, 'zh') INTO _lang FROM public.community_profiles WHERE user_id = _uid;

  INSERT INTO public.community_letters
    (author_id, subject, body, topic, target_age_band, response_style, language,
     status, content_origin, risk_level,
     expires_at)
  VALUES (_uid, NULLIF(btrim(COALESCE(_subject,'')),''), _body,
          NULLIF(btrim(COALESCE(_topic,'')),''), _target_age_band,
          NULLIF(btrim(COALESCE(_response_style,'')),''), COALESCE(_lang,'zh'),
          CASE WHEN _needs_review OR _risk <> 'none' THEN 'pending' ELSE 'approved' END,
          'member', _risk,
          now() + (COALESCE(_cfg.letter_ttl_days, 14) || ' days')::interval)
  RETURNING id INTO _id;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'letter', _id,
          CASE WHEN _risk = 'crisis' THEN 'crisis_flagged'
               WHEN _needs_review OR _risk = 'review' THEN 'queued_for_review'
               ELSE 'auto_approved' END, NULL);

  IF _risk = 'crisis' THEN
    INSERT INTO public.community_reports (reporter_id, target_type, target_id, reason, details, priority)
    VALUES (_uid, 'letter', _id, 'crisis_auto', '系统自动标记：疑似危机/自伤内容，等待人工处理。', 'crisis');
  END IF;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text) TO authenticated, service_role;

-- ── 5. dispatch: config driven, never dispatches samples ─────────
CREATE OR REPLACE FUNCTION public.dispatch_community_letter(_letter_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _existing int; _approved int; _target int;
        _inserted int; _cfg record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.content_origin <> 'member' OR _l.author_id IS NULL THEN RETURN 0; END IF;
  IF _l.author_id <> _uid AND NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _l.status <> 'approved' THEN RETURN 0; END IF;
  IF _l.expires_at <= now() THEN RETURN 0; END IF;

  SELECT * INTO _cfg FROM public.community_delivery_config WHERE id = 1;

  SELECT count(*) INTO _approved FROM public.community_letter_replies
   WHERE letter_id = _letter_id AND status = 'approved';
  IF _approved >= COALESCE(_cfg.max_replies, 3) THEN RETURN 0; END IF;

  SELECT count(*) INTO _existing FROM public.community_letter_deliveries WHERE letter_id = _letter_id;
  IF _existing >= COALESCE(_cfg.max_recipients, 12) THEN RETURN 0; END IF;
  _target := LEAST(COALESCE(_cfg.max_recipients, 12) - _existing,
                   GREATEST(COALESCE(_cfg.first_wave, 5) - _existing, 0) + COALESCE(_cfg.first_wave, 5));
  IF _target <= 0 THEN RETURN 0; END IF;

  WITH pool AS (
    SELECT cp.user_id,
           (SELECT max(d.delivered_at) FROM public.community_letter_deliveries d
             WHERE d.recipient_id = cp.user_id) AS last_delivery
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
     ORDER BY last_delivery NULLS FIRST, random()
     LIMIT _target
  )
  INSERT INTO public.community_letter_deliveries (letter_id, recipient_id)
  SELECT _letter_id, user_id FROM pool
  ON CONFLICT (letter_id, recipient_id) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  INSERT INTO public.community_notifications (user_id, type, entity_id)
  SELECT d.recipient_id, 'letter_received', _letter_id
    FROM public.community_letter_deliveries d
   WHERE d.letter_id = _letter_id AND d.delivered_at > now() - interval '5 seconds';

  RETURN _inserted;
END; $$;

REVOKE ALL ON FUNCTION public.dispatch_community_letter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_community_letter(uuid) TO authenticated, service_role;