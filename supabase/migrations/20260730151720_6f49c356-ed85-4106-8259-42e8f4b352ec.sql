CREATE OR REPLACE FUNCTION public.admin_moderate_community_letter(
  _letter_id uuid, _action text, _notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _new_status text; _delivered int := 0; _redacted text;
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
      _redacted := coalesce(nullif(btrim(_notes), ''), '（本段内容已由馆员脱敏处理，原文不再展示。）');
      IF length(_redacted) < 20 THEN
        _redacted := _redacted || '（本段内容已由馆员脱敏处理，原文不再展示。）';
      END IF;
      IF length(_redacted) > 4000 THEN _redacted := left(_redacted, 4000); END IF;
      UPDATE public.community_letters
         SET body = _redacted, status = 'approved', updated_at = now()
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

    -- restoring visibility must also lift previously sealed deliveries
    IF _action IN ('approve', 'redact') THEN
      UPDATE public.community_letter_deliveries
         SET status = 'delivered'
       WHERE letter_id = _letter_id AND status = 'hidden';
      _delivered := public.dispatch_community_letter(_letter_id);
    END IF;
  END IF;

  UPDATE public.community_reports
     SET status = 'resolved', resolved_at = now(), resolved_by = _uid
   WHERE target_type = 'letter' AND target_id = _letter_id
     AND status IN ('pending', 'reviewing');

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'letter', _letter_id, _action, nullif(btrim(_notes), ''));

  RETURN jsonb_build_object('action', _action, 'delivered', _delivered);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_moderate_community_reply(
  _reply_id uuid, _action text, _notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _new_status text; _redacted text;
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
    _redacted := coalesce(nullif(btrim(_notes), ''), '（本段内容已由馆员脱敏处理，原文不再展示。）');
    IF length(_redacted) < 20 THEN
      _redacted := _redacted || '（本段内容已由馆员脱敏处理，原文不再展示。）';
    END IF;
    IF length(_redacted) > 4000 THEN _redacted := left(_redacted, 4000); END IF;
    UPDATE public.community_letter_replies
       SET body = _redacted, status = 'approved', updated_at = now()
     WHERE id = _reply_id;
  ELSE
    UPDATE public.community_letter_replies
       SET status = _new_status, updated_at = now() WHERE id = _reply_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'reply_not_found' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.community_reports
     SET status = 'resolved', resolved_at = now(), resolved_by = _uid
   WHERE target_type = 'reply' AND target_id = _reply_id
     AND status IN ('pending', 'reviewing');

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'reply', _reply_id, _action, nullif(btrim(_notes), ''));

  RETURN jsonb_build_object('action', _action);
END; $$;