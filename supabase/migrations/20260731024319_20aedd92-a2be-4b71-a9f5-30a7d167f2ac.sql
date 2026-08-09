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
    'userId', h.user_id,
    'alias', h.alias,
    'ageBand', h.age_band,
    'academy', h.academy,
    'element', h.element,
    'quote', h.quote,
    'language', h.language,
    'assignedCount', h.assigned_count,
    'acceptedCount', h.accepted_count,
    'repliedCount', h.replied_count,
    'declinedCount', h.declined_count,
    'pendingCount', h.pending_count,
    'lastAssignedAt', h.last_assigned_at
  ) ORDER BY h.last_assigned_at NULLS FIRST), '[]'::jsonb)
    INTO _out
  FROM (
    SELECT p.user_id, p.alias, p.age_band, p.academy, p.element, p.quote, p.language,
           COALESCE(a.assigned_count, 0) AS assigned_count,
           COALESCE(a.accepted_count, 0) AS accepted_count,
           COALESCE(a.replied_count, 0) AS replied_count,
           COALESCE(a.declined_count, 0) AS declined_count,
           COALESCE(a.pending_count, 0) AS pending_count,
           a.last_assigned_at
    FROM public.community_profiles p
    LEFT JOIN (
      SELECT assignee_id,
             count(*) AS assigned_count,
             count(*) FILTER (WHERE status = 'accepted') AS accepted_count,
             count(*) FILTER (WHERE status = 'replied') AS replied_count,
             count(*) FILTER (WHERE status = 'declined') AS declined_count,
             count(*) FILTER (WHERE status = 'pending') AS pending_count,
             max(created_at) AS last_assigned_at
      FROM public.community_letter_assignments
      GROUP BY assignee_id
    ) a ON a.assignee_id = p.user_id
    WHERE p.accepts_assignments AND p.status = 'active' AND p.opt_in
  ) h;

  RETURN _out;
END; $function$;

REVOKE ALL ON FUNCTION public.librarian_list_helpers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.librarian_list_helpers() TO authenticated;