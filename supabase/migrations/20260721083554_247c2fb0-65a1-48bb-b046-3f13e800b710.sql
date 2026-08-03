
ALTER FUNCTION public.community_match_pair_key(UUID, UUID) SET search_path = public;
ALTER FUNCTION public.community_match_alias_for(UUID) SET search_path = public;
ALTER FUNCTION public.community_match_set_updated_at() SET search_path = public;

DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.community_match_opt_in(TEXT, BOOLEAN, TEXT)',
    'public.community_match_set_paused(BOOLEAN)',
    'public.community_match_opt_out()',
    'public.community_match_recommend(INT)',
    'public.community_match_invite_by_alias(TEXT, TEXT)',
    'public.community_match_respond(UUID, TEXT)',
    'public.community_match_revoke_invite(UUID)',
    'public.community_match_revoke_grant(TEXT, TEXT)',
    'public.community_match_upsert_result(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB)',
    'public.community_match_expire_stale()'
  ])
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || fn || ' FROM PUBLIC, anon';
  END LOOP;
END $$;
