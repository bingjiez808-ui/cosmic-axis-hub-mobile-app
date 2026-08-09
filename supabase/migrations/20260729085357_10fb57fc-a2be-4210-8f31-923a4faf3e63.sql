-- =========================================================
-- 1) Fix community_email_verified() — drop user_metadata trust
-- =========================================================
CREATE OR REPLACE FUNCTION public.community_email_verified()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    -- Trusted, auth-system-managed top-level JWT claims only.
    COALESCE(auth.jwt() ->> 'email_confirmed_at', '') <> ''
    OR COALESCE(auth.jwt() ->> 'phone_confirmed_at', '') <> ''
    OR COALESCE(auth.jwt() ->> 'confirmed_at', '') <> ''
    -- Federated identity providers (oauth): treated as verified.
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', 'email') NOT IN ('email', 'phone')
  );
$function$;

-- =========================================================
-- 2) Restrict community_likes SELECT to relevant participants
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read community likes" ON public.community_likes;

CREATE POLICY "Users see own likes and likes on their content"
  ON public.community_likes
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_likes.post_id AND p.user_id = auth.uid()
    ))
    OR (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_comments c
      WHERE c.id = community_likes.comment_id AND c.user_id = auth.uid()
    ))
  );

-- =========================================================
-- 3) Lock down SECURITY DEFINER function EXECUTE privileges
-- =========================================================

-- 3a) Trigger + system/cron helpers — no direct RPC callers at all.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_updated()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_membership_write_guard()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_match_expire_stale()        FROM PUBLIC, anon, authenticated;

-- 3b) Admin-only functions — internal admin check exists, but no need
--     to expose EXECUTE to anon; only authenticated (admin verified inside).
REVOKE EXECUTE ON FUNCTION public.admin_ai_usage_summary(timestamp with time zone)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_redemption_code(text,text,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_redemption_code(text,text,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_disable_redemption_code(uuid)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_redemption_codes(text,text,text,integer)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_redemption_uses(uuid,uuid,integer)                           FROM PUBLIC, anon;

-- 3c) Internal grant / chapter claim helpers — only wrappers should call these.
REVOKE EXECUTE ON FUNCTION public.apply_membership_grant(uuid,text,integer,text,text,text,integer)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_premium_chapter_for_user(uuid,uuid,text,integer,uuid,integer)     FROM PUBLIC, anon, authenticated;

-- 3d) User-facing RPCs — authenticated users must be able to call them,
--     but anonymous visitors never should. Each function checks auth.uid() internally.
REVOKE EXECUTE ON FUNCTION public.claim_premium_chapter(uuid,text,integer,uuid,integer)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_invite_by_alias(text,text)                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_opt_in(text,boolean,text)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_opt_out()                                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_recommend(integer)                                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_respond(uuid,text)                                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_revoke_grant(text,text)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_revoke_invite(uuid)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_set_paused(boolean)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_match_upsert_result(text,text,text,jsonb,jsonb,jsonb)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_my_redemption_uses()                                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_code(text,text,uuid,text,text,text)                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_chart_role(uuid,text)                                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_primary_chart(uuid)                                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.simulate_mock_membership_upgrade(text,text,text)                        FROM PUBLIC, anon;