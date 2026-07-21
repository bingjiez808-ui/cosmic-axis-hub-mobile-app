-- ================================================================
--  Pending migration — Friends, Chart-Match Consents, Notifications,
--  and saved-chart housekeeping columns.
--
--  Not executed automatically. Review before applying.
--  Depends on: public.charts (existing).
-- ================================================================

-- ── 1. Charts: display name + default + soft delete ─────────────
ALTER TABLE public.charts
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS is_default   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- One default chart per user.
CREATE UNIQUE INDEX IF NOT EXISTS charts_one_default_per_user
  ON public.charts (user_id)
  WHERE is_default = true AND deleted_at IS NULL;

-- De-dup only among live charts (soft-deleted rows keep their hash).
DROP INDEX IF EXISTS charts_user_id_normalized_input_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS charts_user_hash_live_unique
  ON public.charts (user_id, normalized_input_hash)
  WHERE deleted_at IS NULL;

-- ── 2. Friend invites (one-time code) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,                    -- "inv_" prefix
  target_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','rejected','cancelled','expired')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.friend_invites TO authenticated;
GRANT ALL ON public.friend_invites TO service_role;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

-- Only inviter or target may see the row.
CREATE POLICY "friend_invites_participant_select" ON public.friend_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = target_id);

CREATE POLICY "friend_invites_inviter_insert" ON public.friend_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "friend_invites_participant_update" ON public.friend_invites
  FOR UPDATE TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = target_id)
  WITH CHECK (auth.uid() = inviter_id OR auth.uid() = target_id);

-- ── 3. Friendships (accepted, canonical pair) ───────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id  UUID REFERENCES public.friend_invites(id) ON DELETE SET NULL,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (a_user_id < b_user_id)  -- canonical order
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_live_unique
  ON public.friendships (a_user_id, b_user_id)
  WHERE removed_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_participant_select" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() IN (a_user_id, b_user_id));

CREATE POLICY "friendships_participant_update" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (a_user_id, b_user_id))
  WITH CHECK (auth.uid() IN (a_user_id, b_user_id));

-- Inserts done server-side (through invite acceptance server fn).

-- ── 4. Friend blocks + reports ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.friend_blocks TO authenticated;
GRANT ALL ON public.friend_blocks TO service_role;
ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_blocks_owner_all" ON public.friend_blocks
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.friend_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  detail       TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','reviewing','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.friend_reports TO authenticated;
GRANT ALL ON public.friend_reports TO service_role;
ALTER TABLE public.friend_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_reports_reporter_select" ON public.friend_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "friend_reports_reporter_insert" ON public.friend_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ── 5. Chart-match consents (bidirectional authorization) ───────
CREATE TABLE IF NOT EXISTS public.chart_match_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  a_chart_id  UUID REFERENCES public.charts(id) ON DELETE SET NULL,
  b_chart_id  UUID REFERENCES public.charts(id) ON DELETE SET NULL,
  mode        TEXT NOT NULL DEFAULT 'friendship'
              CHECK (mode IN ('friendship','romantic','family','work')),
  a_consented_at TIMESTAMPTZ,
  b_consented_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  result_json JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (a_user_id < b_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS chart_match_consents_pair_live_unique
  ON public.chart_match_consents (a_user_id, b_user_id, mode)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.chart_match_consents TO authenticated;
GRANT ALL ON public.chart_match_consents TO service_role;
ALTER TABLE public.chart_match_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_match_participant_select" ON public.chart_match_consents
  FOR SELECT TO authenticated
  USING (auth.uid() IN (a_user_id, b_user_id));

CREATE POLICY "chart_match_participant_upsert" ON public.chart_match_consents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (a_user_id, b_user_id));

CREATE POLICY "chart_match_participant_update" ON public.chart_match_consents
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (a_user_id, b_user_id))
  WITH CHECK (auth.uid() IN (a_user_id, b_user_id));

-- ── 6. Notifications (friend request / match request / match completed)
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN (
                'friend_invite_received',
                'friend_invite_accepted',
                'match_request',
                'match_ready',
                'match_revoked'
              )),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ref_id      UUID,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- End of pending migration.
