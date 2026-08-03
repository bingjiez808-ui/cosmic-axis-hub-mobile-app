
-- ============================================================
-- Community anonymous match pool + friends infra (idempotent)
-- ============================================================

-- ---------- friend_invites / friendships / friend_blocks / friend_reports (from pending) ----------

CREATE TABLE IF NOT EXISTS public.friend_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL UNIQUE,
  target_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','rejected','cancelled','expired')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.friend_invites TO authenticated;
GRANT ALL ON public.friend_invites TO service_role;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_invites' AND policyname='friend_invites_participant_select') THEN
    CREATE POLICY "friend_invites_participant_select" ON public.friend_invites
      FOR SELECT TO authenticated USING (auth.uid() = inviter_id OR auth.uid() = target_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_invites' AND policyname='friend_invites_inviter_insert') THEN
    CREATE POLICY "friend_invites_inviter_insert" ON public.friend_invites
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_invites' AND policyname='friend_invites_participant_update') THEN
    CREATE POLICY "friend_invites_participant_update" ON public.friend_invites
      FOR UPDATE TO authenticated USING (auth.uid() = inviter_id OR auth.uid() = target_id)
      WITH CHECK (auth.uid() = inviter_id OR auth.uid() = target_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id  UUID REFERENCES public.friend_invites(id) ON DELETE SET NULL,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (a_user_id < b_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_live_unique
  ON public.friendships (a_user_id, b_user_id) WHERE removed_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friendships' AND policyname='friendships_participant_select') THEN
    CREATE POLICY "friendships_participant_select" ON public.friendships
      FOR SELECT TO authenticated USING (auth.uid() IN (a_user_id, b_user_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friendships' AND policyname='friendships_participant_update') THEN
    CREATE POLICY "friendships_participant_update" ON public.friendships
      FOR UPDATE TO authenticated USING (auth.uid() IN (a_user_id, b_user_id))
      WITH CHECK (auth.uid() IN (a_user_id, b_user_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.friend_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.friend_blocks TO authenticated;
GRANT ALL ON public.friend_blocks TO service_role;
ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_blocks' AND policyname='friend_blocks_owner_all') THEN
    CREATE POLICY "friend_blocks_owner_all" ON public.friend_blocks
      FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.friend_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.friend_reports TO authenticated;
GRANT ALL ON public.friend_reports TO service_role;
ALTER TABLE public.friend_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_reports' AND policyname='friend_reports_reporter_select') THEN
    CREATE POLICY "friend_reports_reporter_select" ON public.friend_reports
      FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_reports' AND policyname='friend_reports_reporter_insert') THEN
    CREATE POLICY "friend_reports_reporter_insert" ON public.friend_reports
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

-- ---------- community_match_profiles ----------

CREATE TABLE IF NOT EXISTS public.community_match_profiles (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_chart_id   UUID REFERENCES public.charts(id) ON DELETE SET NULL,
  anonymous_alias    TEXT NOT NULL UNIQUE,
  age_band           TEXT CHECK (age_band IN ('18-24','25-34','35-44','45-54','55+')),
  show_age_band      BOOLEAN NOT NULL DEFAULT true,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  paused_at          TIMESTAMPTZ,
  consent_version    TEXT NOT NULL,
  consented_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_recommended_at TIMESTAMPTZ,
  recommend_count_today INTEGER NOT NULL DEFAULT 0,
  recommend_day_key  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.community_match_profiles TO authenticated;
GRANT ALL ON public.community_match_profiles TO service_role;
ALTER TABLE public.community_match_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_match_profiles' AND policyname='cmp_owner_select') THEN
    CREATE POLICY "cmp_owner_select" ON public.community_match_profiles
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_match_profiles' AND policyname='cmp_owner_update') THEN
    CREATE POLICY "cmp_owner_update" ON public.community_match_profiles
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- community_match_invites ----------

CREATE TABLE IF NOT EXISTS public.community_match_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode         TEXT NOT NULL DEFAULT 'friendship'
               CHECK (mode IN ('friendship','romantic','family','work')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','expired','revoked','blocked')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cmi_pending_unique
  ON public.community_match_invites (sender_id, recipient_id, mode)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS cmi_recipient_status ON public.community_match_invites (recipient_id, status);
GRANT SELECT ON public.community_match_invites TO authenticated;
GRANT ALL ON public.community_match_invites TO service_role;
ALTER TABLE public.community_match_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_match_invites' AND policyname='cmi_participant_select') THEN
    CREATE POLICY "cmi_participant_select" ON public.community_match_invites
      FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
  END IF;
END $$;

-- ---------- community_match_grants ----------

CREATE TABLE IF NOT EXISTS public.community_match_grants (
  pair_key       TEXT NOT NULL,
  a_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode           TEXT NOT NULL DEFAULT 'friendship',
  a_granted_at   TIMESTAMPTZ,
  b_granted_at   TIMESTAMPTZ,
  a_revoked_at   TIMESTAMPTZ,
  b_revoked_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pair_key, mode),
  CHECK (a_user_id < b_user_id)
);
GRANT SELECT ON public.community_match_grants TO authenticated;
GRANT ALL ON public.community_match_grants TO service_role;
ALTER TABLE public.community_match_grants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_match_grants' AND policyname='cmg_participant_select') THEN
    CREATE POLICY "cmg_participant_select" ON public.community_match_grants
      FOR SELECT TO authenticated USING (auth.uid() IN (a_user_id, b_user_id));
  END IF;
END $$;

-- ---------- community_match_results ----------

CREATE TABLE IF NOT EXISTS public.community_match_results (
  pair_key           TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'friendship',
  a_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculator_version TEXT NOT NULL,
  facets_snapshot    JSONB NOT NULL,
  score_snapshot     JSONB NOT NULL,
  evidence_summary   JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ready',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pair_key, mode, calculator_version),
  CHECK (a_user_id < b_user_id)
);
GRANT SELECT ON public.community_match_results TO authenticated;
GRANT ALL ON public.community_match_results TO service_role;
ALTER TABLE public.community_match_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_match_results' AND policyname='cmr_participant_select') THEN
    CREATE POLICY "cmr_participant_select" ON public.community_match_results
      FOR SELECT TO authenticated
      USING (
        auth.uid() IN (a_user_id, b_user_id)
        AND EXISTS (
          SELECT 1 FROM public.community_match_grants g
          WHERE g.pair_key = community_match_results.pair_key
            AND g.mode = community_match_results.mode
            AND g.a_granted_at IS NOT NULL AND g.b_granted_at IS NOT NULL
            AND g.a_revoked_at IS NULL AND g.b_revoked_at IS NULL
        )
      );
  END IF;
END $$;

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.community_match_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cmp_upd ON public.community_match_profiles;
CREATE TRIGGER trg_cmp_upd BEFORE UPDATE ON public.community_match_profiles
  FOR EACH ROW EXECUTE FUNCTION public.community_match_set_updated_at();
DROP TRIGGER IF EXISTS trg_cmi_upd ON public.community_match_invites;
CREATE TRIGGER trg_cmi_upd BEFORE UPDATE ON public.community_match_invites
  FOR EACH ROW EXECUTE FUNCTION public.community_match_set_updated_at();
DROP TRIGGER IF EXISTS trg_cmg_upd ON public.community_match_grants;
CREATE TRIGGER trg_cmg_upd BEFORE UPDATE ON public.community_match_grants
  FOR EACH ROW EXECUTE FUNCTION public.community_match_set_updated_at();

-- ============================================================
-- RPCs (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.community_match_pair_key(_a UUID, _b UUID) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(_a, _b)::text || ':' || greatest(_a, _b)::text;
$$;

-- Deterministic alias generator
CREATE OR REPLACE FUNCTION public.community_match_alias_for(_uid UUID) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  words TEXT[] := ARRAY[
    'nebula','ember','tide','loam','aether','quill','opal','harbor',
    'lantern','marrow','cinder','fable','glacier','solstice','vellum',
    'wren','myrrh','onyx','pinion','sable','cairn','beacon','herald','arbor'
  ];
  h BIGINT;
  w TEXT;
  n INT;
BEGIN
  h := ('x' || substr(md5(_uid::text), 1, 8))::bit(32)::bigint;
  w := words[1 + (h % array_length(words, 1))];
  n := (abs(h) / 100)::int % 10000;
  RETURN w || '-' || lpad(n::text, 4, '0');
END; $$;

-- opt in / update
CREATE OR REPLACE FUNCTION public.community_match_opt_in(
  _age_band TEXT, _show_age_band BOOLEAN, _consent_version TEXT
) RETURNS public.community_match_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _primary UUID;
  _row public.community_match_profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT id INTO _primary FROM public.charts
    WHERE user_id = _uid AND is_primary = true AND chart_role = 'self' LIMIT 1;
  IF _primary IS NULL THEN RAISE EXCEPTION 'primary_chart_required'; END IF;
  IF _age_band IS NOT NULL AND _age_band NOT IN ('18-24','25-34','35-44','45-54','55+') THEN
    RAISE EXCEPTION 'invalid_age_band';
  END IF;

  INSERT INTO public.community_match_profiles (
    user_id, primary_chart_id, anonymous_alias, age_band, show_age_band,
    is_active, paused_at, consent_version, consented_at
  ) VALUES (
    _uid, _primary, public.community_match_alias_for(_uid), _age_band,
    COALESCE(_show_age_band, true), true, NULL, _consent_version, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_chart_id = EXCLUDED.primary_chart_id,
    age_band = EXCLUDED.age_band,
    show_age_band = EXCLUDED.show_age_band,
    is_active = true,
    paused_at = NULL,
    consent_version = EXCLUDED.consent_version,
    consented_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.community_match_set_paused(_paused BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  UPDATE public.community_match_profiles
    SET paused_at = CASE WHEN _paused THEN now() ELSE NULL END,
        is_active = NOT _paused
    WHERE user_id = _uid;
END; $$;

CREATE OR REPLACE FUNCTION public.community_match_opt_out() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  DELETE FROM public.community_match_profiles WHERE user_id = _uid;
  -- Note: results/grants preserved for audit; participants can still revoke.
END; $$;

-- Recommend anonymous candidates. Returns only whitelisted fields.
CREATE OR REPLACE FUNCTION public.community_match_recommend(_limit INT DEFAULT 10)
RETURNS TABLE (
  invite_target_id UUID,   -- opaque to caller only through server layer
  alias TEXT,
  age_band TEXT,
  is_paused BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _me public.community_match_profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _me FROM public.community_match_profiles WHERE user_id = _uid;
  IF _me IS NULL OR NOT _me.is_active THEN RAISE EXCEPTION 'not_in_pool'; END IF;

  -- Rate limit: 60s cooldown, 200/day
  IF _me.last_recommended_at IS NOT NULL AND _me.last_recommended_at > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF _me.recommend_day_key <> CURRENT_DATE THEN
    UPDATE public.community_match_profiles
      SET recommend_day_key = CURRENT_DATE, recommend_count_today = 0
      WHERE user_id = _uid;
    _me.recommend_count_today := 0;
  END IF;
  IF _me.recommend_count_today >= 200 THEN RAISE EXCEPTION 'daily_limit'; END IF;

  UPDATE public.community_match_profiles
    SET last_recommended_at = now(),
        recommend_count_today = recommend_count_today + 1
    WHERE user_id = _uid;

  RETURN QUERY
  SELECT p.user_id, p.anonymous_alias,
         CASE WHEN p.show_age_band THEN p.age_band ELSE NULL END,
         (p.paused_at IS NOT NULL)
    FROM public.community_match_profiles p
   WHERE p.user_id <> _uid
     AND p.is_active = true
     AND p.paused_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.friend_blocks fb
        WHERE (fb.blocker_id = _uid AND fb.blocked_id = p.user_id)
           OR (fb.blocker_id = p.user_id AND fb.blocked_id = _uid)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.community_match_invites i
        WHERE ((i.sender_id = _uid AND i.recipient_id = p.user_id)
               OR (i.sender_id = p.user_id AND i.recipient_id = _uid))
          AND i.status = 'pending' AND i.expires_at > now()
     )
   ORDER BY md5(_uid::text || p.user_id::text)
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 10), 20));
END; $$;

-- Send invite by alias
CREATE OR REPLACE FUNCTION public.community_match_invite_by_alias(_alias TEXT, _mode TEXT DEFAULT 'friendship')
RETURNS public.community_match_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _target UUID;
  _row public.community_match_invites;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF _mode NOT IN ('friendship','romantic','family','work') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  SELECT user_id INTO _target FROM public.community_match_profiles
    WHERE anonymous_alias = _alias AND is_active = true AND paused_at IS NULL;
  IF _target IS NULL THEN RAISE EXCEPTION 'candidate_unavailable'; END IF;
  IF _target = _uid THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;

  -- Blocked either direction → reject
  IF EXISTS (SELECT 1 FROM public.friend_blocks
              WHERE (blocker_id = _uid AND blocked_id = _target)
                 OR (blocker_id = _target AND blocked_id = _uid)) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  INSERT INTO public.community_match_invites (sender_id, recipient_id, mode)
  VALUES (_uid, _target, _mode)
  ON CONFLICT (sender_id, recipient_id, mode) WHERE status = 'pending'
  DO NOTHING
  RETURNING * INTO _row;
  IF _row IS NULL THEN RAISE EXCEPTION 'duplicate_pending'; END IF;
  RETURN _row;
END; $$;

-- Respond to invite
CREATE OR REPLACE FUNCTION public.community_match_respond(_invite_id UUID, _action TEXT)
RETURNS public.community_match_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.community_match_invites;
  _a UUID; _b UUID; _pk TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF _action NOT IN ('accept','decline','block') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO _row FROM public.community_match_invites WHERE id = _invite_id;
  IF _row IS NULL OR _row.recipient_id <> _uid THEN RAISE EXCEPTION 'not_recipient'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF _row.expires_at <= now() THEN
    UPDATE public.community_match_invites SET status='expired', responded_at=now() WHERE id=_invite_id;
    RAISE EXCEPTION 'expired';
  END IF;

  IF _action = 'decline' THEN
    UPDATE public.community_match_invites SET status='declined', responded_at=now() WHERE id=_invite_id RETURNING * INTO _row;
    RETURN _row;
  ELSIF _action = 'block' THEN
    INSERT INTO public.friend_blocks (blocker_id, blocked_id, reason)
    VALUES (_uid, _row.sender_id, 'community_match_block')
    ON CONFLICT DO NOTHING;
    UPDATE public.community_match_invites SET status='blocked', responded_at=now() WHERE id=_invite_id RETURNING * INTO _row;
    RETURN _row;
  END IF;

  -- accept → set both grants
  UPDATE public.community_match_invites SET status='accepted', responded_at=now() WHERE id=_invite_id RETURNING * INTO _row;
  _a := LEAST(_row.sender_id, _row.recipient_id);
  _b := GREATEST(_row.sender_id, _row.recipient_id);
  _pk := public.community_match_pair_key(_row.sender_id, _row.recipient_id);
  INSERT INTO public.community_match_grants (pair_key, a_user_id, b_user_id, mode, a_granted_at, b_granted_at)
  VALUES (_pk, _a, _b, _row.mode, now(), now())
  ON CONFLICT (pair_key, mode) DO UPDATE
    SET a_granted_at = COALESCE(public.community_match_grants.a_granted_at, now()),
        b_granted_at = COALESCE(public.community_match_grants.b_granted_at, now()),
        a_revoked_at = NULL, b_revoked_at = NULL;
  RETURN _row;
END; $$;

-- Revoke sent invite
CREATE OR REPLACE FUNCTION public.community_match_revoke_invite(_invite_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  UPDATE public.community_match_invites
     SET status='revoked', responded_at=now()
     WHERE id=_invite_id AND sender_id=_uid AND status='pending';
END; $$;

-- Revoke my grant for a pair
CREATE OR REPLACE FUNCTION public.community_match_revoke_grant(_pair_key TEXT, _mode TEXT DEFAULT 'friendship')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  UPDATE public.community_match_grants
     SET a_revoked_at = CASE WHEN a_user_id=_uid AND a_revoked_at IS NULL THEN now() ELSE a_revoked_at END,
         b_revoked_at = CASE WHEN b_user_id=_uid AND b_revoked_at IS NULL THEN now() ELSE b_revoked_at END
     WHERE pair_key = _pair_key AND mode = _mode AND _uid IN (a_user_id, b_user_id);
END; $$;

-- Persist result snapshot (server-computed; called from server fn after facts calc)
CREATE OR REPLACE FUNCTION public.community_match_upsert_result(
  _pair_key TEXT, _mode TEXT, _calc_version TEXT,
  _facets JSONB, _score JSONB, _evidence JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _a UUID; _b UUID; _g public.community_match_grants;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _g FROM public.community_match_grants WHERE pair_key=_pair_key AND mode=_mode;
  IF _g IS NULL OR _uid NOT IN (_g.a_user_id, _g.b_user_id) THEN RAISE EXCEPTION 'not_pair_member'; END IF;
  IF _g.a_granted_at IS NULL OR _g.b_granted_at IS NULL
     OR _g.a_revoked_at IS NOT NULL OR _g.b_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'grants_incomplete';
  END IF;
  INSERT INTO public.community_match_results
    (pair_key, mode, a_user_id, b_user_id, calculator_version, facets_snapshot, score_snapshot, evidence_summary)
  VALUES (_pair_key, _mode, _g.a_user_id, _g.b_user_id, _calc_version, _facets, _score, _evidence)
  ON CONFLICT (pair_key, mode, calculator_version) DO NOTHING;
END; $$;

-- Expire stale invites (safe to call anytime; idempotent)
CREATE OR REPLACE FUNCTION public.community_match_expire_stale()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.community_match_invites SET status='expired', responded_at=now()
   WHERE status='pending' AND expires_at <= now();
$$;

GRANT EXECUTE ON FUNCTION public.community_match_opt_in(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_set_paused(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_opt_out() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_recommend(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_invite_by_alias(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_respond(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_revoke_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_revoke_grant(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_upsert_result(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_match_expire_stale() TO authenticated;
