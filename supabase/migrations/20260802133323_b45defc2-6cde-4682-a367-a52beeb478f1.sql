-- 1) Revoke direct execution of internal trigger helper functions
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 2) Stop exposing raw user_id on the public community wall
REVOKE SELECT ON public.community_posts FROM anon, authenticated;
REVOKE SELECT ON public.community_comments FROM anon, authenticated;

GRANT SELECT (id, facet, body_text, author_title, author_house_key, image_paths, created_at, updated_at, deleted_at)
  ON public.community_posts TO anon, authenticated;
GRANT SELECT (id, post_id, parent_id, body_text, author_title, author_house_key, created_at, updated_at, deleted_at)
  ON public.community_comments TO anon, authenticated;

-- 3) Scope community storage reads to owner or still-visible posts
DROP POLICY IF EXISTS "Community images are readable by signed-in users" ON storage.objects;
CREATE POLICY "Community images are readable when attached to visible posts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'community'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.deleted_at IS NULL AND name = ANY (p.image_paths)
    )
  )
);