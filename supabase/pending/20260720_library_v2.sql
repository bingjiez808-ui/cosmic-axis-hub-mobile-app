-- ============================================================================
-- Guided Library V2 · pending migration
--
-- STATUS: pending — do NOT run automatically. The Demo runs entirely on the
-- fixture repository under src/experiences/library-v2/story/repository.ts.
-- When switching V2 to a cloud backend, apply this file through the migration
-- tool and flip BACKEND_MODE.
--
-- Design constraints (see docs/LIBRARY_V2_GUIDED_EXPERIENCE.md):
--   * Raw birth data, city, gender and any chart JSON MUST NOT be stored
--     in any v2_* table. Only derived fields (age_band, topic).
--   * Every public row is scoped by RLS.
--   * v2_historical_figures is the ONLY table with anon SELECT.
-- ============================================================================

-- Reader profile (derived-only fields; birth data lives elsewhere).
CREATE TABLE IF NOT EXISTS public.v2_reader_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '匿名读者',
  age_band TEXT CHECK (age_band IN ('18-24','25-29','30-34','35-39','40-49','50+')),
  interest_topics TEXT[] NOT NULL DEFAULT '{}',
  matching_opt_in BOOLEAN NOT NULL DEFAULT true,
  chart_ref UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_reader_profiles TO authenticated;
GRANT ALL ON public.v2_reader_profiles TO service_role;
ALTER TABLE public.v2_reader_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_profile_owner_all" ON public.v2_reader_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Exploration events (own read/insert only).
CREATE TABLE IF NOT EXISTS public.v2_exploration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NULL,
  event_type TEXT NOT NULL,
  topic TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.v2_exploration_events TO authenticated;
GRANT ALL ON public.v2_exploration_events TO service_role;
ALTER TABLE public.v2_exploration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_events_owner_rw" ON public.v2_exploration_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Historical figures (curated content, published-only for readers).
CREATE TABLE IF NOT EXISTS public.v2_historical_figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tradition TEXT NOT NULL CHECK (tradition IN ('east','west')),
  age_band TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  situation TEXT NOT NULL,
  choice TEXT NOT NULL,
  outcome TEXT NOT NULL,
  cost TEXT NOT NULL,
  transferable TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  warning TEXT NOT NULL,
  different_choice BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.v2_historical_figures TO anon, authenticated;
GRANT ALL ON public.v2_historical_figures TO service_role;
ALTER TABLE public.v2_historical_figures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_figures_read_published" ON public.v2_historical_figures
  FOR SELECT USING (status = 'published');

-- Personalised recommendations, own only.
CREATE TABLE IF NOT EXISTS public.v2_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NULL,
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_recommendations TO authenticated;
GRANT ALL ON public.v2_recommendations TO service_role;
ALTER TABLE public.v2_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_recs_owner" ON public.v2_recommendations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fate notes (public list; author-owned writes).
CREATE TABLE IF NOT EXISTS public.v2_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (topic IN ('career','love','wealth','recent')),
  body TEXT NOT NULL,
  image_path TEXT NULL,
  audience_mode TEXT NOT NULL CHECK (audience_mode IN ('similar','opposite','experienced','librarian')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reported','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT v2_notes_no_pii CHECK (
    body !~* '\y(19|20)\d{2}[-/\.]\d{1,2}[-/\.]\d{1,2}\y'
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_notes TO authenticated;
GRANT SELECT ON public.v2_notes TO anon;
GRANT ALL ON public.v2_notes TO service_role;
ALTER TABLE public.v2_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_notes_public_read" ON public.v2_notes
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY "v2_notes_author_write" ON public.v2_notes
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "v2_notes_author_update" ON public.v2_notes
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "v2_notes_author_delete" ON public.v2_notes
  FOR DELETE USING (auth.uid() = author_id);

-- Abstract match traits per note (server-generated; NEVER raw chart data).
CREATE TABLE IF NOT EXISTS public.v2_note_match_traits (
  note_id UUID PRIMARY KEY REFERENCES public.v2_notes(id) ON DELETE CASCADE,
  traits TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.v2_note_match_traits TO anon, authenticated;
GRANT ALL ON public.v2_note_match_traits TO service_role;
ALTER TABLE public.v2_note_match_traits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_traits_public_read" ON public.v2_note_match_traits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.v2_notes n
    WHERE n.id = v2_note_match_traits.note_id
      AND n.status = 'active' AND n.deleted_at IS NULL
  ));

-- Replies to notes (structured fields).
CREATE TABLE IF NOT EXISTS public.v2_note_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.v2_notes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faced TEXT NOT NULL,
  chose TEXT NOT NULL,
  cost TEXT NOT NULL,
  if_again TEXT NOT NULL,
  one_consideration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reported','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_note_replies TO authenticated;
GRANT SELECT ON public.v2_note_replies TO anon;
GRANT ALL ON public.v2_note_replies TO service_role;
ALTER TABLE public.v2_note_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_replies_public_read" ON public.v2_note_replies
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY "v2_replies_author_write" ON public.v2_note_replies
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "v2_replies_author_update" ON public.v2_note_replies
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "v2_replies_author_delete" ON public.v2_note_replies
  FOR DELETE USING (auth.uid() = author_id);

-- Save / report actions.
CREATE TABLE IF NOT EXISTS public.v2_note_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('note','reply')),
  target_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('save','report')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (actor_id, target_kind, target_id, kind)
);
GRANT SELECT, INSERT, DELETE ON public.v2_note_actions TO authenticated;
GRANT ALL ON public.v2_note_actions TO service_role;
ALTER TABLE public.v2_note_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_actions_owner" ON public.v2_note_actions
  FOR ALL USING (auth.uid() = actor_id) WITH CHECK (auth.uid() = actor_id);

-- Cross-object saved items (figures, books, notes).
CREATE TABLE IF NOT EXISTS public.v2_saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, reference_id)
);
GRANT SELECT, INSERT, DELETE ON public.v2_saved_items TO authenticated;
GRANT ALL ON public.v2_saved_items TO service_role;
ALTER TABLE public.v2_saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_saved_owner" ON public.v2_saved_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Hard-purge scaffold (SECURITY DEFINER; service-role only; unused until wired).
CREATE OR REPLACE FUNCTION public.v2_purge_deleted_notes(_older_than_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n INT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only' USING ERRCODE = '42501';
  END IF;
  WITH deleted AS (
    DELETE FROM public.v2_notes
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - make_interval(days => _older_than_days)
    RETURNING id
  )
  SELECT COUNT(*) INTO _n FROM deleted;
  RETURN _n;
END;
$$;

-- Common updated_at trigger.
CREATE OR REPLACE FUNCTION public.v2_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER v2_profiles_touch BEFORE UPDATE ON public.v2_reader_profiles
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
CREATE TRIGGER v2_notes_touch BEFORE UPDATE ON public.v2_notes
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
CREATE TRIGGER v2_replies_touch BEFORE UPDATE ON public.v2_note_replies
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
CREATE TRIGGER v2_figures_touch BEFORE UPDATE ON public.v2_historical_figures
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
