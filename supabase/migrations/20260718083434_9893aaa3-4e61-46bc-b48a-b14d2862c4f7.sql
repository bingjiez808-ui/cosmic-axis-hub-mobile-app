CREATE OR REPLACE FUNCTION public.community_email_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    COALESCE(NULLIF(auth.jwt() ->> 'email_verified', '')::boolean, false)
    OR COALESCE(NULLIF(auth.jwt() -> 'user_metadata' ->> 'email_verified', '')::boolean, false)
    OR COALESCE(auth.jwt() ->> 'email_confirmed_at', '') <> ''
    OR COALESCE(auth.jwt() ->> 'confirmed_at', '') <> ''
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'email_confirmed_at', '') <> ''
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', 'email') NOT IN ('email', 'phone')
  );
$$;

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facet text NOT NULL CHECK (facet IN ('character', 'vocation', 'love', 'shadow', 'gift')),
  body_text text NOT NULL CHECK (char_length(btrim(body_text)) BETWEEN 1 AND 1200),
  author_title text NOT NULL CHECK (char_length(author_title) BETWEEN 1 AND 80),
  author_house_key text NOT NULL CHECK (author_house_key IN ('ember', 'loam', 'aether', 'tide')),
  image_paths text[] NOT NULL DEFAULT '{}'::text[] CHECK (array_length(image_paths, 1) IS NULL OR array_length(image_paths, 1) <= 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active community posts"
ON public.community_posts
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL);
CREATE POLICY "Verified users can create their own community posts"
ON public.community_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.community_email_verified());
CREATE POLICY "Authors can update their own community posts"
ON public.community_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.community_email_verified());
CREATE POLICY "Authors can delete their own community posts"
ON public.community_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER set_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_text text NOT NULL CHECK (char_length(btrim(body_text)) BETWEEN 1 AND 600),
  author_title text NOT NULL CHECK (char_length(author_title) BETWEEN 1 AND 80),
  author_house_key text NOT NULL CHECK (author_house_key IN ('ember', 'loam', 'aether', 'tide')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active community comments"
ON public.community_comments
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL);
CREATE POLICY "Verified users can create their own community comments"
ON public.community_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.community_email_verified()
  AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.deleted_at IS NULL
  )
);
CREATE POLICY "Authors can update their own community comments"
ON public.community_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.community_email_verified());
CREATE POLICY "Authors can delete their own community comments"
ON public.community_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER set_community_comments_updated_at
BEFORE UPDATE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

CREATE TABLE IF NOT EXISTS public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL)),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, comment_id)
);
GRANT SELECT ON public.community_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read community likes"
ON public.community_likes
FOR SELECT
TO anon, authenticated
USING (true);
CREATE POLICY "Verified users can like as themselves"
ON public.community_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.community_email_verified());
CREATE POLICY "Users can remove their own likes"
ON public.community_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON public.community_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS community_comments_post_created_idx ON public.community_comments (post_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS community_likes_post_idx ON public.community_likes (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_likes_comment_idx ON public.community_likes (comment_id) WHERE comment_id IS NOT NULL;

CREATE POLICY "Community images are readable by signed-in users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'community');
CREATE POLICY "Verified users can upload community images to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community'
  AND public.community_email_verified()
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower((storage.filename(name))) ~ '\.(jpg|jpeg|png|webp)$'
  AND COALESCE((metadata ->> 'size')::bigint, 0) <= 5242880
);
CREATE POLICY "Users can delete own community images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'community' AND (storage.foldername(name))[1] = auth.uid()::text);
