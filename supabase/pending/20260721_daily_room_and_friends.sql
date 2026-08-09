-- Daily Reading Room + Friends & Chart-Match — PENDING (do not execute yet).
--
-- This migration is the DDL sketch approved in .lovable/plan.md batches 2+4.
-- It is intentionally left in supabase/pending/ so no schema change lands
-- while the surface is still gated by VITE_ENABLE_DAILY_ROOM. When ready,
-- move (or copy) this file into supabase/migrations/ via the migration tool.

-- =========================================================
-- 1. Daily Reading Room
-- =========================================================

CREATE TABLE IF NOT EXISTS public.user_home_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_chart_id UUID,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_home_preferences TO authenticated;
GRANT ALL ON public.user_home_preferences TO service_role;
ALTER TABLE public.user_home_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_home_preferences_owner" ON public.user_home_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_fact_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL,
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  calculator_version TEXT NOT NULL,
  facts_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chart_id, local_date, timezone, calculator_version)
);
GRANT SELECT, INSERT ON public.daily_fact_snapshots TO authenticated;
GRANT ALL ON public.daily_fact_snapshots TO service_role;
ALTER TABLE public.daily_fact_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_fact_snapshots_owner_read" ON public.daily_fact_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_fact_snapshots_owner_write" ON public.daily_fact_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL,
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  score_version TEXT NOT NULL,
  score_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chart_id, local_date, timezone, score_version)
);
GRANT SELECT, INSERT ON public.daily_score_snapshots TO authenticated;
GRANT ALL ON public.daily_score_snapshots TO service_role;
ALTER TABLE public.daily_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_score_snapshots_owner_read" ON public.daily_score_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_score_snapshots_owner_write" ON public.daily_score_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL,
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  model_id TEXT NOT NULL,
  content_json JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chart_id, local_date, timezone, skill_version, prompt_hash, model_id)
);
GRANT SELECT, INSERT ON public.daily_readings TO authenticated;
GRANT ALL ON public.daily_readings TO service_role;
ALTER TABLE public.daily_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_readings_owner" ON public.daily_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_readings_owner_write" ON public.daily_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 2. Friends & chart-match consent
-- =========================================================

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (from_user, to_user, status) DEFERRABLE INITIALLY DEFERRED
);
GRANT SELECT, INSERT, UPDATE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_requests_participant_read" ON public.friend_requests
  FOR SELECT USING (auth.uid() IN (from_user, to_user));
CREATE POLICY "friend_requests_sender_insert" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "friend_requests_recipient_update" ON public.friend_requests
  FOR UPDATE USING (auth.uid() IN (from_user, to_user));

-- Canonical, order-independent pair key (sorted).
CREATE OR REPLACE FUNCTION public.pair_key(_a UUID, _b UUID)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _a < _b THEN _a::text || '|' || _b::text ELSE _b::text || '|' || _a::text END;
$$;

CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL GENERATED ALWAYS AS (public.pair_key(user_a, user_b)) STORED,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  UNIQUE (pair_key)
);
GRANT SELECT, INSERT, UPDATE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_participant" ON public.friendships
  FOR SELECT USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "friendships_participant_update" ON public.friendships
  FOR UPDATE USING (auth.uid() IN (user_a, user_b));

CREATE TABLE IF NOT EXISTS public.chart_match_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id UUID NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id UUID NOT NULL,
  consultation_mode TEXT NOT NULL DEFAULT 'friendship'
    CHECK (consultation_mode IN ('friendship','romantic','work')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (friendship_id, user_id, consultation_mode)
);
GRANT SELECT, INSERT, UPDATE ON public.chart_match_consents TO authenticated;
GRANT ALL ON public.chart_match_consents TO service_role;
ALTER TABLE public.chart_match_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chart_match_consents_owner_write" ON public.chart_match_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chart_match_consents_owner_update" ON public.chart_match_consents
  FOR UPDATE USING (auth.uid() = user_id);
-- Participants may read consents that belong to their friendship, but
-- never see the raw natal facts — the calculator only serves a snapshot.
CREATE POLICY "chart_match_consents_participant_read" ON public.chart_match_consents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.id = chart_match_consents.friendship_id
        AND auth.uid() IN (f.user_a, f.user_b)
    )
  );

CREATE TABLE IF NOT EXISTS public.compatibility_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id UUID NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  pair_snapshot_key TEXT NOT NULL,
  score_version TEXT NOT NULL,
  content_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed','partial','failed','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (friendship_id, pair_snapshot_key, score_version)
);
GRANT SELECT, INSERT, UPDATE ON public.compatibility_snapshots TO authenticated;
GRANT ALL ON public.compatibility_snapshots TO service_role;
ALTER TABLE public.compatibility_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compatibility_snapshots_participant_read" ON public.compatibility_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.id = compatibility_snapshots.friendship_id
        AND auth.uid() IN (f.user_a, f.user_b)
    )
  );

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker, blocked)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_blocks_owner" ON public.user_blocks
  FOR ALL USING (auth.uid() = blocker) WITH CHECK (auth.uid() = blocker);

CREATE TABLE IF NOT EXISTS public.social_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_post_id UUID,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.social_reports TO authenticated;
GRANT ALL ON public.social_reports TO service_role;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_reports_reporter_insert" ON public.social_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter);
CREATE POLICY "social_reports_reporter_read" ON public.social_reports
  FOR SELECT USING (auth.uid() = reporter);

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('friend_request','friend_accepted','match_ready','consent_revoked','system')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "in_app_notifications_owner_read" ON public.in_app_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "in_app_notifications_owner_update" ON public.in_app_notifications
  FOR UPDATE USING (auth.uid() = user_id);
