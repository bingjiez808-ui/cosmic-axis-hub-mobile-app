-- ── 1. letters gain a public-wall visibility mode ─────────────────
-- 'delivered_only' = courier-assigned (default), 'wall' = public board,
-- 'published' = curated library samples (unchanged).
ALTER TABLE public.community_letters
  DROP CONSTRAINT IF EXISTS community_letters_visibility_chk;
ALTER TABLE public.community_letters
  ADD CONSTRAINT community_letters_visibility_chk
  CHECK (visibility IN ('delivered_only','published','wall'));

CREATE INDEX IF NOT EXISTS community_letters_public_idx
  ON public.community_letters (visibility, status, created_at DESC);

-- ── 2. send: accept the chosen visibility ─────────────────────────
DROP FUNCTION IF EXISTS public.send_community_letter(text,text,text,text,text,boolean,text);

CREATE OR REPLACE FUNCTION public.send_community_letter(
  _subject text,
  _body text,
  _topic text,
  _target_age_band text,
  _response_style text,
  _needs_review boolean DEFAULT false,
  _risk_level text DEFAULT 'none',
  _visibility text DEFAULT 'delivered_only'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _band text; _lang text; _sent int; _id uuid; _dup int;
        _cfg record; _risk text := COALESCE(NULLIF(btrim(_risk_level),''),'none');
        _vis text := COALESCE(NULLIF(btrim(_visibility),''),'delivered_only');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _risk NOT IN ('none','review','crisis') THEN _risk := 'none'; END IF;
  IF _vis NOT IN ('delivered_only','wall') THEN _vis := 'delivered_only'; END IF;
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
     status, content_origin, risk_level, visibility, expires_at)
  VALUES (_uid, NULLIF(btrim(COALESCE(_subject,'')),''), _body,
          NULLIF(btrim(COALESCE(_topic,'')),''), _target_age_band,
          NULLIF(btrim(COALESCE(_response_style,'')),''), COALESCE(_lang,'zh'),
          CASE WHEN _needs_review OR _risk <> 'none' THEN 'pending' ELSE 'approved' END,
          'member', _risk, _vis,
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

REVOKE ALL ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text,text) TO authenticated, service_role;

-- ── 3. reply: recipients for directed letters, everyone for public ─
CREATE OR REPLACE FUNCTION public.reply_to_community_letter(
  _letter_id uuid,
  _body text,
  _needs_review boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _cnt int; _id uuid; _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF public.community_age_band(_uid) IS NULL THEN
    RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT l.* INTO _l FROM public.community_letters l WHERE l.id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;

  IF _l.visibility = 'wall' THEN
    IF _l.status <> 'approved' THEN RAISE EXCEPTION 'letter_closed' USING ERRCODE = '53400'; END IF;
    IF _l.author_id = _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.community_blocks b
                WHERE (b.blocker_id = _uid AND b.blocked_user_id = _l.author_id)
                   OR (b.blocker_id = _l.author_id AND b.blocked_user_id = _uid)) THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.community_letter_replies r
                WHERE r.letter_id = _letter_id AND r.author_id = _uid) THEN
      RAISE EXCEPTION 'already_replied' USING ERRCODE = '53400';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.community_letter_deliveries d
                    WHERE d.letter_id = _letter_id AND d.recipient_id = _uid
                      AND d.status <> 'hidden') THEN
      RAISE EXCEPTION 'not_a_recipient' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _l.expires_at <= now() THEN RAISE EXCEPTION 'letter_expired' USING ERRCODE = '53400'; END IF;

  _body := btrim(_body);
  IF length(_body) < 10 OR length(_body) > 3000 THEN
    RAISE EXCEPTION 'invalid_body_length' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO _cnt FROM public.community_letter_replies
   WHERE author_id = _uid AND created_at > now() - interval '1 hour';
  IF _cnt >= 10 THEN RAISE EXCEPTION 'hourly_reply_limit' USING ERRCODE = '53400'; END IF;

  IF EXISTS (SELECT 1 FROM public.community_letter_replies
              WHERE letter_id = _letter_id AND author_id = _uid AND body = _body
                AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'duplicate_submission' USING ERRCODE = '53400';
  END IF;

  _status := CASE WHEN _needs_review THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.community_letter_replies (letter_id, author_id, body, status)
  VALUES (_letter_id, _uid, _body, _status)
  RETURNING id INTO _id;

  UPDATE public.community_letter_deliveries
     SET status = 'replied', replied_at = now()
   WHERE letter_id = _letter_id AND recipient_id = _uid;

  IF _status = 'approved' THEN
    INSERT INTO public.community_notifications (user_id, type, entity_id)
    VALUES (_l.author_id, 'reply_received', _id);
  END IF;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action)
  VALUES (_uid, 'reply', _id, CASE WHEN _needs_review THEN 'queued_for_review' ELSE 'auto_approved' END);

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) TO authenticated, service_role;

-- ── 4. public wall: list ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_community_public_wall(_limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _out jsonb; _n int := LEAST(GREATEST(COALESCE(_limit,30),1),60);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF public.community_age_band(_uid) IS NULL THEN
    RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'createdAt' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
      'responseStyle', l.response_style, 'targetAgeBand', l.target_age_band,
      'createdAt', l.created_at, 'expiresAt', l.expires_at, 'status', l.status,
      'mine', (l.author_id = _uid),
      'echoCount', (SELECT count(*) FROM public.community_letter_replies r
                     WHERE r.letter_id = l.id AND r.status = 'approved'),
      'iReplied', EXISTS (SELECT 1 FROM public.community_letter_replies r2
                           WHERE r2.letter_id = l.id AND r2.author_id = _uid),
      'author', jsonb_build_object(
        'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
        'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
    ) AS x
    FROM public.community_letters l
    LEFT JOIN public.community_profiles cp ON cp.user_id = l.author_id
    WHERE l.visibility = 'wall'
      AND l.status IN ('approved','closed')
      AND l.expires_at > now()
      AND NOT EXISTS (SELECT 1 FROM public.community_blocks b
                       WHERE (b.blocker_id = _uid AND b.blocked_user_id = l.author_id)
                          OR (b.blocker_id = l.author_id AND b.blocked_user_id = _uid))
    ORDER BY l.created_at DESC
    LIMIT _n
  ) s;

  RETURN _out;
END; $$;

REVOKE ALL ON FUNCTION public.get_community_public_wall(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_community_public_wall(integer) TO authenticated, service_role;

-- ── 5. public wall: one letter with its echoes ────────────────────
CREATE OR REPLACE FUNCTION public.get_community_public_letter(_letter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF public.community_age_band(_uid) IS NULL THEN
    RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT l.* INTO _l FROM public.community_letters l
   WHERE l.id = _letter_id AND l.visibility = 'wall'
     AND l.status IN ('approved','closed') AND l.expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;

  IF EXISTS (SELECT 1 FROM public.community_blocks b
              WHERE (b.blocker_id = _uid AND b.blocked_user_id = _l.author_id)
                 OR (b.blocker_id = _l.author_id AND b.blocked_user_id = _uid)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'letterId', _l.id, 'subject', _l.subject, 'body', _l.body, 'topic', _l.topic,
    'responseStyle', _l.response_style, 'targetAgeBand', _l.target_age_band,
    'createdAt', _l.created_at, 'expiresAt', _l.expires_at, 'status', _l.status,
    'mine', (_l.author_id = _uid),
    'iReplied', EXISTS (SELECT 1 FROM public.community_letter_replies r2
                         WHERE r2.letter_id = _l.id AND r2.author_id = _uid),
    'author', (SELECT jsonb_build_object(
                 'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
                 'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
               FROM public.community_profiles cp WHERE cp.user_id = _l.author_id),
    'echoes', COALESCE((
      SELECT jsonb_agg(z ORDER BY z->>'createdAt' ASC) FROM (
        SELECT jsonb_build_object(
          'replyId', r.id, 'body', r.body, 'createdAt', r.created_at,
          'mine', (r.author_id = _uid),
          'author', jsonb_build_object(
            'alias', cp2.alias, 'academy', cp2.academy, 'element', cp2.element,
            'avatarUrl', cp2.avatar_url, 'quote', cp2.quote, 'ageBand', cp2.age_band)
        ) AS z
        FROM public.community_letter_replies r
        LEFT JOIN public.community_profiles cp2 ON cp2.user_id = r.author_id
        WHERE r.letter_id = _l.id AND r.status = 'approved'
          AND NOT EXISTS (SELECT 1 FROM public.community_blocks b2
                           WHERE (b2.blocker_id = _uid AND b2.blocked_user_id = r.author_id)
                              OR (b2.blocker_id = r.author_id AND b2.blocked_user_id = _uid))
        ORDER BY r.created_at ASC LIMIT 200
      ) s
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END; $$;

REVOKE ALL ON FUNCTION public.get_community_public_letter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_community_public_letter(uuid) TO authenticated, service_role;