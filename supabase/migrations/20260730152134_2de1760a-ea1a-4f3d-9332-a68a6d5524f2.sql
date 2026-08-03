ALTER TABLE public.community_letter_replies
  ADD COLUMN IF NOT EXISTS saved_by_author_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_community_echo_saved(
  _reply_id uuid, _saved boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _author uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT l.author_id INTO _author
    FROM public.community_letter_replies r
    JOIN public.community_letters l ON l.id = r.letter_id
   WHERE r.id = _reply_id;

  IF _author IS NULL THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = 'P0002'; END IF;
  IF _author <> _uid THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  UPDATE public.community_letter_replies
     SET saved_by_author_at = CASE WHEN _saved THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _reply_id;

  RETURN _saved;
END; $$;

CREATE OR REPLACE FUNCTION public.close_community_letter(
  _letter_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT status INTO _status FROM public.community_letters
   WHERE id = _letter_id AND author_id = _uid;
  IF _status IS NULL THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = 'P0002'; END IF;
  IF _status NOT IN ('approved', 'pending') THEN RETURN _status; END IF;

  UPDATE public.community_letters
     SET status = 'closed', updated_at = now()
   WHERE id = _letter_id AND author_id = _uid;

  RETURN 'closed';
END; $$;

REVOKE ALL ON FUNCTION public.set_community_echo_saved(uuid, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.close_community_letter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_community_echo_saved(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_community_letter(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_community_mailbox()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'ageBand', public.community_age_band(_uid),
    'received', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'deliveredAt' DESC) FROM (
        SELECT jsonb_build_object(
          'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
          'responseStyle', l.response_style, 'targetAgeBand', l.target_age_band,
          'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'deliveredAt', d.delivered_at, 'readAt', d.read_at, 'repliedAt', d.replied_at,
          'status', d.status,
          'author', jsonb_build_object(
            'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
            'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
        ) AS x
        FROM public.community_letter_deliveries d
        JOIN public.community_letters l ON l.id = d.letter_id
        LEFT JOIN public.community_profiles cp ON cp.user_id = l.author_id
        WHERE d.recipient_id = _uid AND d.status <> 'hidden' AND l.status = 'approved'
        ORDER BY d.delivered_at DESC LIMIT 100
      ) s
    ), '[]'::jsonb),
    'sent', COALESCE((
      SELECT jsonb_agg(y ORDER BY y->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object(
          'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
          'targetAgeBand', l.target_age_band, 'status', l.status,
          'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'deliveredCount', (SELECT count(*) FROM public.community_letter_deliveries d WHERE d.letter_id = l.id),
          'replyCount', (SELECT count(*) FROM public.community_letter_replies r
                          WHERE r.letter_id = l.id AND r.status = 'approved')
        ) AS y
        FROM public.community_letters l
        WHERE l.author_id = _uid
        ORDER BY l.created_at DESC LIMIT 100
      ) s2
    ), '[]'::jsonb),
    'echoes', COALESCE((
      SELECT jsonb_agg(z ORDER BY z->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object(
          'replyId', r.id, 'letterId', r.letter_id, 'body', r.body, 'createdAt', r.created_at,
          'savedAt', r.saved_by_author_at,
          'author', jsonb_build_object(
            'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
            'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
        ) AS z
        FROM public.community_letter_replies r
        JOIN public.community_letters l ON l.id = r.letter_id
        LEFT JOIN public.community_profiles cp ON cp.user_id = r.author_id
        WHERE l.author_id = _uid AND r.status = 'approved'
        ORDER BY r.created_at DESC LIMIT 100
      ) s3
    ), '[]'::jsonb),
    'myReplies', COALESCE((
      SELECT jsonb_agg(w ORDER BY w->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('replyId', r.id, 'letterId', r.letter_id, 'body', r.body,
                                  'status', r.status, 'createdAt', r.created_at) AS w
        FROM public.community_letter_replies r
        WHERE r.author_id = _uid ORDER BY r.created_at DESC LIMIT 100
      ) s4
    ), '[]'::jsonb),
    'notifications', COALESCE((
      SELECT jsonb_agg(n ORDER BY n->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('id', nt.id, 'type', nt.type, 'entityId', nt.entity_id,
                                  'readAt', nt.read_at, 'createdAt', nt.created_at) AS n
        FROM public.community_notifications nt
        WHERE nt.user_id = _uid ORDER BY nt.created_at DESC LIMIT 50
      ) s5
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END; $$;