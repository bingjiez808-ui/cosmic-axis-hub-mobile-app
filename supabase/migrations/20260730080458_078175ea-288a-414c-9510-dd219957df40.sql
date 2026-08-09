-- 1) Let recipients archive/unarchive their own deliveries from the client.
CREATE OR REPLACE FUNCTION public.community_deliveries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.letter_id := OLD.letter_id;
    NEW.recipient_id := OLD.recipient_id;
    NEW.delivered_at := OLD.delivered_at;
    NEW.replied_at := OLD.replied_at;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('read', 'archived')
       AND NOT (OLD.status = 'archived' AND NEW.status IN ('delivered', 'read', 'replied')) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 2) Admin moderation of a letter.
CREATE OR REPLACE FUNCTION public.admin_moderate_community_letter(
  _letter_id uuid, _action text, _notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _new_status text; _delivered int := 0;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _action NOT IN ('approve', 'hide', 'reject', 'redact', 'redispatch') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  IF _action = 'redispatch' THEN
    _delivered := public.dispatch_community_letter(_letter_id);
  ELSE
    _new_status := CASE _action
      WHEN 'approve' THEN 'approved'
      WHEN 'hide' THEN 'hidden'
      WHEN 'reject' THEN 'rejected'
      ELSE 'approved' END;
    IF _action = 'redact' THEN
      UPDATE public.community_letters
         SET body = coalesce(nullif(btrim(_notes), ''), '（本段内容已由馆员脱敏）'),
             status = 'approved', updated_at = now()
       WHERE id = _letter_id;
    ELSE
      UPDATE public.community_letters
         SET status = _new_status, updated_at = now()
       WHERE id = _letter_id;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = 'P0002'; END IF;
    IF _action = 'hide' THEN
      UPDATE public.community_letter_deliveries SET status = 'hidden' WHERE letter_id = _letter_id;
    END IF;
    IF _action = 'approve' THEN
      _delivered := public.dispatch_community_letter(_letter_id);
    END IF;
  END IF;

  UPDATE public.community_reports
     SET status = 'resolved', resolved_at = now(), resolved_by = _uid
   WHERE target_type = 'letter' AND target_id = _letter_id AND status = 'open';

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'letter', _letter_id, _action, nullif(btrim(_notes), ''));

  RETURN jsonb_build_object('action', _action, 'delivered', _delivered);
END; $$;

-- 3) Admin moderation of a reply.
CREATE OR REPLACE FUNCTION public.admin_moderate_community_reply(
  _reply_id uuid, _action text, _notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _new_status text;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _action NOT IN ('approve', 'hide', 'reject', 'redact') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  _new_status := CASE _action WHEN 'approve' THEN 'approved' WHEN 'hide' THEN 'hidden'
                              WHEN 'reject' THEN 'rejected' ELSE 'approved' END;
  IF _action = 'redact' THEN
    UPDATE public.community_letter_replies
       SET body = coalesce(nullif(btrim(_notes), ''), '（本段内容已由馆员脱敏）'),
           status = 'approved', updated_at = now()
     WHERE id = _reply_id;
  ELSE
    UPDATE public.community_letter_replies
       SET status = _new_status, updated_at = now() WHERE id = _reply_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'reply_not_found' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.community_reports
     SET status = 'resolved', resolved_at = now(), resolved_by = _uid
   WHERE target_type = 'reply' AND target_id = _reply_id AND status = 'open';

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'reply', _reply_id, _action, nullif(btrim(_notes), ''));

  RETURN jsonb_build_object('action', _action);
END; $$;

-- 4) Admin suspend / restore a participant.
CREATE OR REPLACE FUNCTION public.admin_set_community_participation(
  _user_id uuid, _status text, _notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('active', 'paused', 'banned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_profiles
     SET status = _status, opt_in = CASE WHEN _status = 'active' THEN opt_in ELSE false END,
         updated_at = now()
   WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'profile', _user_id, 'set_status_' || _status, nullif(btrim(_notes), ''));

  RETURN jsonb_build_object('status', _status);
END; $$;

-- 5) Admin dashboard payload (redacted; internal ids only for admins).
CREATE OR REPLACE FUNCTION public.admin_community_hall_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'letters', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object(
          'id', l.id, 'authorId', l.author_id, 'subject', l.subject, 'body', left(l.body, 1200),
          'topic', l.topic, 'targetAgeBand', l.target_age_band, 'status', l.status,
          'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'deliveredCount', (SELECT count(*) FROM public.community_letter_deliveries d WHERE d.letter_id = l.id),
          'replyCount', (SELECT count(*) FROM public.community_letter_replies r WHERE r.letter_id = l.id),
          'reportCount', (SELECT count(*) FROM public.community_reports rp
                           WHERE rp.target_type = 'letter' AND rp.target_id = l.id AND rp.status = 'open')
        ) AS x
        FROM public.community_letters l ORDER BY l.created_at DESC LIMIT 200
      ) s
    ), '[]'::jsonb),
    'replies', COALESCE((
      SELECT jsonb_agg(y ORDER BY y->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('id', r.id, 'letterId', r.letter_id, 'authorId', r.author_id,
          'body', left(r.body, 1200), 'status', r.status, 'createdAt', r.created_at,
          'reportCount', (SELECT count(*) FROM public.community_reports rp
                           WHERE rp.target_type = 'reply' AND rp.target_id = r.id AND rp.status = 'open')) AS y
        FROM public.community_letter_replies r ORDER BY r.created_at DESC LIMIT 200
      ) s2
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(z ORDER BY z->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('id', rp.id, 'targetType', rp.target_type, 'targetId', rp.target_id,
          'reason', rp.reason, 'details', rp.details, 'status', rp.status,
          'createdAt', rp.created_at, 'resolvedAt', rp.resolved_at) AS z
        FROM public.community_reports rp ORDER BY rp.created_at DESC LIMIT 200
      ) s3
    ), '[]'::jsonb),
    'participants', COALESCE((
      SELECT jsonb_agg(p ORDER BY p->>'updatedAt' DESC) FROM (
        SELECT jsonb_build_object('userId', cp.user_id, 'alias', cp.alias, 'ageBand', cp.age_band,
          'optIn', cp.opt_in, 'status', cp.status, 'updatedAt', cp.updated_at) AS p
        FROM public.community_profiles cp ORDER BY cp.updated_at DESC LIMIT 200
      ) s4
    ), '[]'::jsonb),
    'deliveries', COALESCE((
      SELECT jsonb_agg(d ORDER BY d->>'deliveredAt' DESC) FROM (
        SELECT jsonb_build_object('id', dv.id, 'letterId', dv.letter_id, 'recipientId', dv.recipient_id,
          'status', dv.status, 'deliveredAt', dv.delivered_at, 'readAt', dv.read_at,
          'repliedAt', dv.replied_at) AS d
        FROM public.community_letter_deliveries dv ORDER BY dv.delivered_at DESC LIMIT 200
      ) s5
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(e ORDER BY e->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('id', ev.id, 'actorId', ev.actor_id, 'targetType', ev.target_type,
          'targetId', ev.target_id, 'action', ev.action, 'notes', ev.notes,
          'createdAt', ev.created_at) AS e
        FROM public.community_moderation_events ev ORDER BY ev.created_at DESC LIMIT 200
      ) s6
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END; $$;

REVOKE ALL ON FUNCTION public.admin_moderate_community_letter(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_moderate_community_reply(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_community_participation(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_community_hall_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_community_letter(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_community_reply(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_community_participation(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_hall_overview() TO authenticated;