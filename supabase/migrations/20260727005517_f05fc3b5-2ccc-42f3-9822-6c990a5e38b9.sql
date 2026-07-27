
-- =============== user_preferences ===============
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  life_stage text CHECK (life_stage IN (
    'learning_self','early_adulthood','building_life','midlife_reassessment','maturity_legacy'
  )),
  life_stage_source text CHECK (life_stage_source IN ('auto','user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_preferences owner all" ON public.user_preferences;
CREATE POLICY "user_preferences owner all" ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== life_bookmarks ===============
CREATE TABLE IF NOT EXISTS public.life_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  figure_key text NOT NULL,
  stage text,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, figure_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_bookmarks TO authenticated;
GRANT ALL ON public.life_bookmarks TO service_role;
ALTER TABLE public.life_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "life_bookmarks owner all" ON public.life_bookmarks;
CREATE POLICY "life_bookmarks owner all" ON public.life_bookmarks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS life_bookmarks_user_idx ON public.life_bookmarks(user_id, created_at DESC);

-- =============== life_responses ===============
CREATE TABLE IF NOT EXISTS public.life_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  figure_key text NOT NULL,
  stage text,
  domain text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, figure_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_responses TO authenticated;
GRANT ALL ON public.life_responses TO service_role;
ALTER TABLE public.life_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "life_responses owner all" ON public.life_responses;
CREATE POLICY "life_responses owner all" ON public.life_responses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS life_responses_user_idx ON public.life_responses(user_id, updated_at DESC);

-- updated_at trigger reused if exists; create if missing
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS life_responses_updated_at ON public.life_responses;
CREATE TRIGGER life_responses_updated_at BEFORE UPDATE ON public.life_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
