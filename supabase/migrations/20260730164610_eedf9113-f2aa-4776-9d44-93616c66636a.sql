-- ── Batch D · admin operating metrics ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_community_hall_metrics(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _since timestamptz;
  _out jsonb;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  _days := GREATEST(1, LEAST(COALESCE(_days, 30), 365));
  _since := now() - (_days || ' days')::interval;

  SELECT jsonb_build_object(
    'days', _days,
    'since', _since,
    'letters', (
      SELECT jsonb_build_object(
        'total', count(*),
        'member', count(*) FILTER (WHERE l.content_origin = 'member'),
        'sample', count(*) FILTER (WHERE l.content_origin <> 'member'),
        'approved', count(*) FILTER (WHERE l.status = 'approved'),
        'pending', count(*) FILTER (WHERE l.status = 'pending'),
        'hidden', count(*) FILTER (WHERE l.status = 'hidden'),
        'rejected', count(*) FILTER (WHERE l.status = 'rejected'),
        'closed', count(*) FILTER (WHERE l.status = 'closed'),
        'crisis', count(*) FILTER (WHERE l.risk_level = 'crisis')
      )
      FROM public.community_letters l WHERE l.created_at >= _since
    ),
    'deliveries', (
      SELECT jsonb_build_object(
        'total', count(*),
        'read', count(*) FILTER (WHERE d.read_at IS NOT NULL),
        'replied', count(*) FILTER (WHERE d.replied_at IS NOT NULL),
        'hidden', count(*) FILTER (WHERE d.status = 'hidden')
      )
      FROM public.community_letter_deliveries d WHERE d.delivered_at >= _since
    ),
    'replies', (
      SELECT jsonb_build_object(
        'total', count(*),
        'approved', count(*) FILTER (WHERE r.status = 'approved'),
        'pending', count(*) FILTER (WHERE r.status = 'pending'),
        'hidden', count(*) FILTER (WHERE r.status = 'hidden')
      )
      FROM public.community_letter_replies r WHERE r.created_at >= _since
    ),
    'reports', (
      SELECT jsonb_build_object(
        'total', count(*),
        'open', count(*) FILTER (WHERE rp.status IN ('pending','reviewing','open')),
        'resolved', count(*) FILTER (WHERE rp.status = 'resolved')
      )
      FROM public.community_reports rp WHERE rp.created_at >= _since
    ),
    'participants', (
      SELECT jsonb_build_object(
        'total', count(*),
        'active', count(*) FILTER (WHERE cp.status = 'active' AND cp.opt_in),
        'paused', count(*) FILTER (WHERE cp.status = 'paused'),
        'banned', count(*) FILTER (WHERE cp.status = 'banned'),
        'onboarded', count(*) FILTER (WHERE cp.onboarded_at IS NOT NULL)
      )
      FROM public.community_profiles cp
    ),
    'moderation', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action', a.action, 'count', a.n) ORDER BY a.n DESC)
      FROM (
        SELECT ev.action, count(*) AS n
        FROM public.community_moderation_events ev
        WHERE ev.created_at >= _since
        GROUP BY ev.action
      ) a
    ), '[]'::jsonb),
    'ageBands', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('band', b.target_age_band, 'count', b.n) ORDER BY b.target_age_band)
      FROM (
        SELECT l.target_age_band, count(*) AS n
        FROM public.community_letters l
        WHERE l.created_at >= _since
        GROUP BY l.target_age_band
      ) b
    ), '[]'::jsonb),
    'medianFirstEchoHours', (
      SELECT round(
        (percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (fr.first_reply - fr.created_at)) / 3600.0
        ))::numeric, 1)
      FROM (
        SELECT l.created_at, min(r.created_at) AS first_reply
        FROM public.community_letters l
        JOIN public.community_letter_replies r ON r.letter_id = l.id
        WHERE l.created_at >= _since
        GROUP BY l.id, l.created_at
      ) fr
    )
  ) INTO _out;

  RETURN _out;
END; $$;

REVOKE ALL ON FUNCTION public.admin_community_hall_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_community_hall_metrics(integer) TO authenticated;

-- ── Batch D · admin audit trail with filters ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_community_audit_log(
  _target_type text DEFAULT NULL,
  _action text DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid, actor_id uuid, target_type text, target_id uuid,
  action text, notes text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT ev.id, ev.actor_id, ev.target_type, ev.target_id, ev.action, ev.notes, ev.created_at
      FROM public.community_moderation_events ev
     WHERE (_target_type IS NULL OR ev.target_type = _target_type)
       AND (_action IS NULL OR ev.action = _action)
     ORDER BY ev.created_at DESC
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 500));
END; $$;

REVOKE ALL ON FUNCTION public.admin_community_audit_log(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_community_audit_log(text, text, integer) TO authenticated;

-- ── Batch D · member-initiated data deletion ───────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_community_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _letters int := 0; _replies int := 0; _deliveries int := 0;
  _reports int := 0; _notifications int := 0; _profile int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  DELETE FROM public.community_letter_replies WHERE author_id = _uid;
  GET DIAGNOSTICS _replies = ROW_COUNT;

  DELETE FROM public.community_letter_deliveries WHERE recipient_id = _uid;
  GET DIAGNOSTICS _deliveries = ROW_COUNT;

  DELETE FROM public.community_letters WHERE author_id = _uid;
  GET DIAGNOSTICS _letters = ROW_COUNT;

  DELETE FROM public.community_reports WHERE reporter_id = _uid;
  GET DIAGNOSTICS _reports = ROW_COUNT;

  DELETE FROM public.community_notifications WHERE user_id = _uid;
  GET DIAGNOSTICS _notifications = ROW_COUNT;

  DELETE FROM public.community_profiles WHERE user_id = _uid;
  GET DIAGNOSTICS _profile = ROW_COUNT;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'profile', _uid, 'self_data_deleted', NULL);

  RETURN jsonb_build_object(
    'letters', _letters, 'replies', _replies, 'deliveries', _deliveries,
    'reports', _reports, 'notifications', _notifications, 'profile', _profile
  );
END; $$;

REVOKE ALL ON FUNCTION public.delete_my_community_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_community_data() TO authenticated;