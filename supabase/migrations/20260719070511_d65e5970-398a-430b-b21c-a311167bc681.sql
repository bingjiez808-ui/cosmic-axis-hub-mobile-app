
DROP POLICY IF EXISTS "Anyone can read community likes" ON public.community_likes;

CREATE POLICY "Authenticated users can read community likes"
  ON public.community_likes
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.community_likes FROM anon;
