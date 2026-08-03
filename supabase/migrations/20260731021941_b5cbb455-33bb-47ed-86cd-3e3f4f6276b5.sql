-- 1. Letters gain a destination and (for sage letters) a persona.
ALTER TABLE public.community_letters
  ADD COLUMN IF NOT EXISTS route text NOT NULL DEFAULT 'courier',
  ADD COLUMN IF NOT EXISTS persona_id text;

ALTER TABLE public.community_letters DROP CONSTRAINT IF EXISTS community_letters_route_check;
ALTER TABLE public.community_letters
  ADD CONSTRAINT community_letters_route_check
  CHECK (route IN ('courier','wall','sage','librarian'));

UPDATE public.community_letters SET route = 'wall' WHERE visibility = 'wall' AND route = 'courier';

-- 2. Replies can now come from a distilled sage or from the librarian.
ALTER TABLE public.community_letter_replies
  ADD COLUMN IF NOT EXISTS author_kind text NOT NULL DEFAULT 'traveler',
  ADD COLUMN IF NOT EXISTS persona_id text;
ALTER TABLE public.community_letter_replies ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.community_letter_replies DROP CONSTRAINT IF EXISTS community_letter_replies_author_kind_check;
ALTER TABLE public.community_letter_replies
  ADD CONSTRAINT community_letter_replies_author_kind_check
  CHECK (author_kind IN ('traveler','sage','librarian'));

-- 3. Travelers opt in / out of receiving librarian-assigned letters.
ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS accepts_assignments boolean NOT NULL DEFAULT true;

-- 4. Assignment ledger: librarian hands a letter to one traveler.
CREATE TABLE IF NOT EXISTS public.community_letter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.community_letters(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL,
  assigned_by uuid,
  status text NOT NULL DEFAULT 'pending',
  note text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_letter_assignments_status_check
    CHECK (status IN ('pending','accepted','declined','replied','revoked')),
  CONSTRAINT community_letter_assignments_unique UNIQUE (letter_id, assignee_id)
);

GRANT SELECT, INSERT, UPDATE ON public.community_letter_assignments TO authenticated;
GRANT ALL ON public.community_letter_assignments TO service_role;
ALTER TABLE public.community_letter_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignee reads own assignments" ON public.community_letter_assignments;
CREATE POLICY "assignee reads own assignments"
  ON public.community_letter_assignments FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins manage assignments" ON public.community_letter_assignments;
CREATE POLICY "admins manage assignments"
  ON public.community_letter_assignments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS community_letter_assignments_updated_at ON public.community_letter_assignments;
CREATE TRIGGER community_letter_assignments_updated_at
  BEFORE UPDATE ON public.community_letter_assignments
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

CREATE INDEX IF NOT EXISTS community_letter_assignments_assignee_idx
  ON public.community_letter_assignments (assignee_id, status);

-- 5. Human one-to-one reply credits (3 per month for Sage members).
CREATE TABLE IF NOT EXISTS public.sage_reply_credits (
  user_id uuid PRIMARY KEY,
  granted integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sage_reply_credits TO authenticated;
GRANT ALL ON public.sage_reply_credits TO service_role;
ALTER TABLE public.sage_reply_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own credits readable" ON public.sage_reply_credits;
CREATE POLICY "own credits readable"
  ON public.sage_reply_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS sage_reply_credits_updated_at ON public.sage_reply_credits;
CREATE TRIGGER sage_reply_credits_updated_at
  BEFORE UPDATE ON public.sage_reply_credits
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

-- 6. Letters: assignees + admins can read the letters they were handed.
DROP POLICY IF EXISTS "assignees read assigned letters" ON public.community_letters;
CREATE POLICY "assignees read assigned letters"
  ON public.community_letters FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.community_letter_assignments a
       WHERE a.letter_id = community_letters.id
         AND a.assignee_id = auth.uid()
         AND a.status IN ('pending','accepted','replied')
    )
  );

-- 7. send_community_letter now takes a route + persona.
DROP FUNCTION IF EXISTS public.send_community_letter(text, text, text, text, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.send_community_letter(
  _subject text, _body text, _topic text, _target_age_band text, _response_style text,
  _needs_review boolean DEFAULT false, _risk_level text DEFAULT 'none',
  _visibility text DEFAULT 'delivered_only', _route text DEFAULT 'courier',
  _persona_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _band text; _lang text; _sent int; _id uuid; _dup int;
        _cfg record; _risk text := COALESCE(NULLIF(btrim(_risk_level),''),'none');
        _rt text := COALESCE(NULLIF(btrim(_route),''),'courier');
        _vis text;
        _tier text; _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _risk NOT IN ('none','review','crisis') THEN _risk := 'none'; END IF;
  IF _rt NOT IN ('courier','wall','sage','librarian') THEN _rt := 'courier'; END IF;
  _vis := CASE WHEN _rt = 'wall' THEN 'wall' ELSE 'delivered_only' END;

  _band := public.community_age_band(_uid);
  IF _band IS NULL THEN RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501'; END IF;
  IF _target_age_band NOT IN ('18-22','23-29','30-39','40-49','50-59','60+') THEN
    RAISE EXCEPTION 'invalid_target_age_band' USING ERRCODE = '22023';
  END IF;

  IF _rt = 'sage' THEN
    SELECT membership_tier, membership_expires_at INTO _tier, _exp FROM public.profiles WHERE id = _uid;
    IF COALESCE(_tier,'none') NOT IN ('sage','oracle') OR _exp IS NULL OR _exp <= now() THEN
      RAISE EXCEPTION 'sage_membership_required' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(NULLIF(btrim(_persona_id),''), '') = '' THEN
      RAISE EXCEPTION 'persona_required' USING ERRCODE = '22023';
    END IF;
  END IF;

  _body := btrim(_body);
  IF length(_body) < 20 OR length(_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body_length' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _cfg FROM public.community_delivery_config WHERE id = 1;

  SELECT count(*) INTO _sent FROM public.community_letters
   WHERE author_id = _uid AND created_at > now() - interval '1 day';
  IF _sent >= COALESCE(_cfg.daily_letter_limit, 3) + 3 THEN
    RAISE EXCEPTION 'daily_letter_limit' USING ERRCODE = '53400';
  END IF;

  SELECT count(*) INTO _dup FROM public.community_letters
   WHERE author_id = _uid AND body = _body AND created_at > now() - interval '10 minutes';
  IF _dup > 0 THEN RAISE EXCEPTION 'duplicate_submission' USING ERRCODE = '53400'; END IF;

  SELECT COALESCE(language, 'zh') INTO _lang FROM public.community_profiles WHERE user_id = _uid;

  INSERT INTO public.community_letters
    (author_id, subject, body, topic, target_age_band, response_style, language,
     status, content_origin, risk_level, visibility, route, persona_id, expires_at)
  VALUES (_uid, NULLIF(btrim(COALESCE(_subject,'')),''), _body,
          NULLIF(btrim(COALESCE(_topic,'')),''), _target_age_band,
          NULLIF(btrim(COALESCE(_response_style,'')),''), COALESCE(_lang,'zh'),
          CASE WHEN _needs_review OR _risk <> 'none' THEN 'pending' ELSE 'approved' END,
          'member', _risk, _vis, _rt, NULLIF(btrim(COALESCE(_persona_id,'')),''),
          now() + (COALESCE(_cfg.letter_ttl_days, 14) || ' days')::interval)
  RETURNING id INTO _id;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'letter', _id,
          CASE WHEN _risk = 'crisis' THEN 'crisis_flagged'
               WHEN _needs_review OR _risk = 'review' THEN 'queued_for_review'
               ELSE 'auto_approved' END, _rt);

  IF _risk = 'crisis' THEN
    INSERT INTO public.community_reports (reporter_id, target_type, target_id, reason, details, priority)
    VALUES (_uid, 'letter', _id, 'crisis_auto', '系统自动标记：疑似危机/自伤内容，等待人工处理。', 'crisis');
  END IF;

  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean,text,text,text,text) TO authenticated;

-- 8. Store a sage's answer (author must own the letter).
CREATE OR REPLACE FUNCTION public.record_sage_reply(_letter_id uuid, _persona_id text, _body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _l record; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.author_id <> _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF _l.route <> 'sage' THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.community_letter_replies (letter_id, author_id, body, status, author_kind, persona_id)
  VALUES (_letter_id, NULL, btrim(_body), 'approved', 'sage',
          COALESCE(NULLIF(btrim(_persona_id),''), _l.persona_id))
  RETURNING id INTO _id;

  INSERT INTO public.community_notifications (user_id, type, entity_id)
  VALUES (_uid, 'reply_received', _id);
  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.record_sage_reply(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_sage_reply(uuid,text,text) TO authenticated;

-- 9. My sage / librarian letters with their answers.
CREATE OR REPLACE FUNCTION public.get_my_desk_letters(_route text DEFAULT 'sage')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb; _rt text := COALESCE(NULLIF(btrim(_route),''),'sage');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'createdAt' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
      'route', l.route, 'personaId', l.persona_id, 'status', l.status,
      'createdAt', l.created_at, 'expiresAt', l.expires_at,
      'replies', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'replyId', r.id, 'body', r.body, 'authorKind', r.author_kind,
          'personaId', r.persona_id, 'createdAt', r.created_at
        ) ORDER BY r.created_at), '[]'::jsonb)
        FROM public.community_letter_replies r
        WHERE r.letter_id = l.id AND r.status = 'approved'
      ),
      'assignment', (
        SELECT jsonb_build_object('status', a.status, 'createdAt', a.created_at)
        FROM public.community_letter_assignments a
        WHERE a.letter_id = l.id ORDER BY a.created_at DESC LIMIT 1
      )
    ) AS x
    FROM public.community_letters l
    WHERE l.author_id = _uid AND l.route = _rt
    ORDER BY l.created_at DESC LIMIT 50
  ) s;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_my_desk_letters(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_desk_letters(text) TO authenticated;

-- 10. Sage member credits for a real human one-to-one reply (3 / month).
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
    VALUES (_uid, CASE WHEN _entitled THEN 3 ELSE 0 END, 0, _period)
    RETURNING * INTO _row;
  ELSIF _row.period_start < _period THEN
    UPDATE public.sage_reply_credits
       SET granted = CASE WHEN _entitled THEN 3 ELSE 0 END, used = 0, period_start = _period
     WHERE user_id = _uid RETURNING * INTO _row;
  ELSIF _entitled AND _row.granted = 0 THEN
    UPDATE public.sage_reply_credits SET granted = 3 WHERE user_id = _uid RETURNING * INTO _row;
  END IF;

  RETURN jsonb_build_object('entitled', _entitled, 'granted', _row.granted,
                            'used', _row.used, 'remaining', GREATEST(_row.granted - _row.used, 0),
                            'periodStart', _row.period_start);
END; $function$;

REVOKE ALL ON FUNCTION public.get_sage_reply_credits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_sage_reply_credits() TO authenticated;

-- 11. Spend one credit: escalate a sage letter to a real human answer.
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

  RETURN public.get_sage_reply_credits();
END; $function$;

REVOKE ALL ON FUNCTION public.request_human_reply(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_human_reply(uuid) TO authenticated;

-- 12. Librarian desk: letters waiting for a human answer.
CREATE OR REPLACE FUNCTION public.librarian_list_letters()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'createdAt' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
      'targetAgeBand', l.target_age_band, 'status', l.status, 'createdAt', l.created_at,
      'author', jsonb_build_object('alias', cp.alias, 'ageBand', cp.age_band),
      'replyCount', (SELECT count(*) FROM public.community_letter_replies r
                      WHERE r.letter_id = l.id AND r.status = 'approved'),
      'assignments', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'assignmentId', a.id, 'assigneeId', a.assignee_id, 'status', a.status,
          'alias', (SELECT alias FROM public.community_profiles p WHERE p.user_id = a.assignee_id),
          'createdAt', a.created_at) ORDER BY a.created_at), '[]'::jsonb)
        FROM public.community_letter_assignments a WHERE a.letter_id = l.id
      )
    ) AS x
    FROM public.community_letters l
    LEFT JOIN public.community_profiles cp ON cp.user_id = l.author_id
    WHERE l.route = 'librarian' AND l.expires_at > now()
    ORDER BY l.created_at DESC LIMIT 100
  ) s;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.librarian_list_letters() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.librarian_list_letters() TO authenticated;

-- 13. Librarian: travelers who opted in to receive assignments.
CREATE OR REPLACE FUNCTION public.librarian_list_helpers()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', p.user_id, 'alias', p.alias, 'ageBand', p.age_band, 'academy', p.academy)), '[]'::jsonb)
    INTO _out
  FROM public.community_profiles p
  WHERE p.accepts_assignments AND p.status = 'active' AND p.opt_in;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.librarian_list_helpers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.librarian_list_helpers() TO authenticated;

-- 14. Librarian assigns a letter to one traveler.
CREATE OR REPLACE FUNCTION public.librarian_assign_letter(_letter_id uuid, _assignee uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_profiles p
                  WHERE p.user_id = _assignee AND p.accepts_assignments) THEN
    RAISE EXCEPTION 'assignee_not_accepting' USING ERRCODE = '53400';
  END IF;
  INSERT INTO public.community_letter_assignments (letter_id, assignee_id, assigned_by, note)
  VALUES (_letter_id, _assignee, _uid, NULLIF(btrim(COALESCE(_note,'')),''))
  ON CONFLICT (letter_id, assignee_id)
  DO UPDATE SET status = 'pending', responded_at = NULL, updated_at = now()
  RETURNING id INTO _id;

  INSERT INTO public.community_notifications (user_id, type, entity_id)
  VALUES (_assignee, 'letter_assigned', _letter_id);
  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.librarian_assign_letter(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.librarian_assign_letter(uuid,uuid,text) TO authenticated;

-- 15. Assignee accepts or declines.
CREATE OR REPLACE FUNCTION public.respond_letter_assignment(_assignment_id uuid, _accept boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _st text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  _st := CASE WHEN _accept THEN 'accepted' ELSE 'declined' END;
  UPDATE public.community_letter_assignments
     SET status = _st, responded_at = now(), updated_at = now()
   WHERE id = _assignment_id AND assignee_id = _uid AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN _st;
END; $function$;

REVOKE ALL ON FUNCTION public.respond_letter_assignment(uuid,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_letter_assignment(uuid,boolean) TO authenticated;

-- 16. My assignments (letters handed to me by the librarian).
CREATE OR REPLACE FUNCTION public.get_my_letter_assignments()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'createdAt' DESC), '[]'::jsonb) INTO _out FROM (
    SELECT jsonb_build_object(
      'assignmentId', a.id, 'status', a.status, 'note', a.note, 'createdAt', a.created_at,
      'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
      'expiresAt', l.expires_at,
      'author', jsonb_build_object('alias', cp.alias, 'ageBand', cp.age_band),
      'iReplied', EXISTS (SELECT 1 FROM public.community_letter_replies r
                           WHERE r.letter_id = l.id AND r.author_id = _uid)
    ) AS x
    FROM public.community_letter_assignments a
    JOIN public.community_letters l ON l.id = a.letter_id
    LEFT JOIN public.community_profiles cp ON cp.user_id = l.author_id
    WHERE a.assignee_id = _uid AND a.status IN ('pending','accepted','replied')
    ORDER BY a.created_at DESC LIMIT 50
  ) s;
  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.get_my_letter_assignments() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_letter_assignments() TO authenticated;

-- 17. Replies: accepted assignees and the librarian may answer too.
CREATE OR REPLACE FUNCTION public.reply_to_community_letter(_letter_id uuid, _body text, _needs_review boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _uid uuid := auth.uid(); _l record; _cnt int; _id uuid; _status text;
        _kind text := 'traveler'; _is_admin boolean; _assigned boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF public.community_age_band(_uid) IS NULL THEN
    RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT l.* INTO _l FROM public.community_letters l WHERE l.id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;

  _is_admin := private.has_role(_uid, 'admin'::app_role);
  _assigned := EXISTS (SELECT 1 FROM public.community_letter_assignments a
                        WHERE a.letter_id = _letter_id AND a.assignee_id = _uid
                          AND a.status IN ('accepted','replied'));

  IF COALESCE(_l.route,'courier') = 'librarian' AND (_is_admin OR _assigned) THEN
    IF _l.author_id = _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    IF _is_admin AND NOT _assigned THEN _kind := 'librarian'; END IF;
  ELSIF _l.visibility = 'wall' THEN
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

  INSERT INTO public.community_letter_replies (letter_id, author_id, body, status, author_kind)
  VALUES (_letter_id, _uid, _body, _status, _kind)
  RETURNING id INTO _id;

  UPDATE public.community_letter_deliveries
     SET status = 'replied', replied_at = now()
   WHERE letter_id = _letter_id AND recipient_id = _uid;

  UPDATE public.community_letter_assignments
     SET status = 'replied', updated_at = now()
   WHERE letter_id = _letter_id AND assignee_id = _uid;

  IF _status = 'approved' THEN
    INSERT INTO public.community_notifications (user_id, type, entity_id)
    VALUES (_l.author_id, 'reply_received', _id);
  END IF;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action)
  VALUES (_uid, 'reply', _id, CASE WHEN _needs_review THEN 'queued_for_review' ELSE 'auto_approved' END);

  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) TO authenticated;