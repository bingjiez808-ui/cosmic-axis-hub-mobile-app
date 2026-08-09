-- ============================================================
-- 同门 · 众生之厅 (Community Hall of Beings) — Round 1 backend
-- Idempotent, additive. Does not touch existing community_* legacy tables.
-- ============================================================

-- ---------- 0. private birth date + age band helpers ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

CREATE OR REPLACE FUNCTION private.user_birth_date(_uid uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    (SELECT p.birth_date FROM public.profiles p WHERE p.id = _uid),
    (SELECT c.birth_date::date
       FROM public.charts c
      WHERE c.user_id = _uid
        AND c.is_primary
        AND c.birth_date ~ '^\d{4}-\d{2}-\d{2}$'
      LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.community_age_band(_uid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _bd date; _age int;
BEGIN
  _bd := private.user_birth_date(_uid);
  IF _bd IS NULL THEN RETURN NULL; END IF;
  _age := date_part('year', age(current_date, _bd))::int;
  IF _age < 18 THEN RETURN NULL; END IF;
  IF _age <= 22 THEN RETURN '18-22'; END IF;
  IF _age <= 29 THEN RETURN '23-29'; END IF;
  IF _age <= 39 THEN RETURN '30-39'; END IF;
  IF _age <= 49 THEN RETURN '40-49'; END IF;
  IF _age <= 59 THEN RETURN '50-59'; END IF;
  RETURN '60+';
END;
$$;

REVOKE ALL ON FUNCTION public.community_age_band(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.community_age_band(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.community_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- 1. community_profiles ----------
CREATE TABLE IF NOT EXISTS public.community_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text,
  academy text,
  element text,
  avatar_url text,
  quote text,
  age_band text,
  language text NOT NULL DEFAULT 'zh',
  opt_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.community_profiles
    ADD CONSTRAINT community_profiles_age_band_chk
    CHECK (age_band IS NULL OR age_band IN ('18-22','23-29','30-39','40-49','50-59','60+'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.community_profiles
    ADD CONSTRAINT community_profiles_status_chk
    CHECK (status IN ('active','paused','suspended','banned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.community_profiles
    ADD CONSTRAINT community_profiles_len_chk
    CHECK (
      (alias IS NULL OR length(alias) <= 40) AND
      (academy IS NULL OR length(academy) <= 40) AND
      (element IS NULL OR length(element) <= 24) AND
      (quote IS NULL OR length(quote) <= 140) AND
      (avatar_url IS NULL OR length(avatar_url) <= 400) AND
      length(language) <= 8
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_profiles_pool_idx
  ON public.community_profiles (age_band, language, opt_in, status);

GRANT SELECT, INSERT, UPDATE ON public.community_profiles TO authenticated;
GRANT ALL ON public.community_profiles TO service_role;
ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

-- age_band & status are server-authoritative
CREATE OR REPLACE FUNCTION public.community_profiles_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _band text; _is_admin boolean;
BEGIN
  _is_admin := auth.uid() IS NOT NULL AND private.has_role(auth.uid(), 'admin'::public.app_role);
  _band := public.community_age_band(NEW.user_id);
  IF NOT _is_admin THEN
    IF _band IS NULL THEN
      RAISE EXCEPTION 'community_requires_verified_adult' USING ERRCODE = '42501';
    END IF;
    NEW.age_band := _band;
    IF TG_OP = 'INSERT' THEN
      IF NEW.status NOT IN ('active','paused') THEN NEW.status := 'active'; END IF;
    ELSE
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('active','paused') THEN
        NEW.status := OLD.status;
      END IF;
      IF OLD.status IN ('suspended','banned') THEN NEW.status := OLD.status; END IF;
    END IF;
  ELSE
    NEW.age_band := COALESCE(_band, NEW.age_band);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS community_profiles_guard_trg ON public.community_profiles;
CREATE TRIGGER community_profiles_guard_trg
  BEFORE INSERT OR UPDATE ON public.community_profiles
  FOR EACH ROW EXECUTE FUNCTION public.community_profiles_guard();

DROP POLICY IF EXISTS community_profiles_select_own ON public.community_profiles;
CREATE POLICY community_profiles_select_own ON public.community_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS community_profiles_insert_own ON public.community_profiles;
CREATE POLICY community_profiles_insert_own ON public.community_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS community_profiles_update_own ON public.community_profiles;
CREATE POLICY community_profiles_update_own ON public.community_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- 2. community_letters ----------
CREATE TABLE IF NOT EXISTS public.community_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  body text NOT NULL,
  topic text,
  target_age_band text NOT NULL,
  response_style text,
  language text NOT NULL DEFAULT 'zh',
  visibility text NOT NULL DEFAULT 'delivered_only',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_status_chk
    CHECK (status IN ('pending','approved','rejected','hidden','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_band_chk
    CHECK (target_age_band IN ('18-22','23-29','30-39','40-49','50-59','60+'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_len_chk
    CHECK (length(body) BETWEEN 20 AND 4000
      AND (subject IS NULL OR length(subject) <= 80)
      AND (topic IS NULL OR length(topic) <= 40)
      AND (response_style IS NULL OR length(response_style) <= 40));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letters ADD CONSTRAINT community_letters_visibility_chk
    CHECK (visibility IN ('delivered_only','published'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_letters_author_idx ON public.community_letters (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_letters_dispatch_idx ON public.community_letters (status, target_age_band, expires_at);

GRANT SELECT ON public.community_letters TO authenticated;
GRANT ALL ON public.community_letters TO service_role;
ALTER TABLE public.community_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_letters_select_author ON public.community_letters;
CREATE POLICY community_letters_select_author ON public.community_letters
  FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------- 3. community_letter_deliveries ----------
CREATE TABLE IF NOT EXISTS public.community_letter_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.community_letters(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'delivered',
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  replied_at timestamptz,
  UNIQUE (letter_id, recipient_id)
);
DO $$ BEGIN
  ALTER TABLE public.community_letter_deliveries ADD CONSTRAINT community_deliveries_status_chk
    CHECK (status IN ('delivered','read','replied','skipped','hidden'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_deliveries_recipient_idx
  ON public.community_letter_deliveries (recipient_id, delivered_at DESC);

DROP POLICY IF EXISTS community_letters_select_recipient ON public.community_letters;
CREATE POLICY community_letters_select_recipient ON public.community_letters
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_letter_deliveries d
     WHERE d.letter_id = community_letters.id AND d.recipient_id = auth.uid()
  ));

GRANT SELECT, UPDATE ON public.community_letter_deliveries TO authenticated;
GRANT ALL ON public.community_letter_deliveries TO service_role;
ALTER TABLE public.community_letter_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_deliveries_select_own ON public.community_letter_deliveries;
CREATE POLICY community_deliveries_select_own ON public.community_letter_deliveries
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.community_letters l
                WHERE l.id = community_letter_deliveries.letter_id AND l.author_id = auth.uid())
  );

-- recipient may only mark read; status escalation is blocked by trigger
DROP POLICY IF EXISTS community_deliveries_update_own ON public.community_letter_deliveries;
CREATE POLICY community_deliveries_update_own ON public.community_letter_deliveries
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.community_deliveries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    NEW.letter_id := OLD.letter_id;
    NEW.recipient_id := OLD.recipient_id;
    NEW.delivered_at := OLD.delivered_at;
    NEW.replied_at := OLD.replied_at;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'read' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS community_deliveries_guard_trg ON public.community_letter_deliveries;
CREATE TRIGGER community_deliveries_guard_trg
  BEFORE UPDATE ON public.community_letter_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.community_deliveries_guard();

-- ---------- 4. community_letter_replies ----------
CREATE TABLE IF NOT EXISTS public.community_letter_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.community_letters(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.community_letter_replies ADD CONSTRAINT community_replies_status_chk
    CHECK (status IN ('pending','approved','rejected','hidden'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_letter_replies ADD CONSTRAINT community_replies_len_chk
    CHECK (length(body) BETWEEN 10 AND 3000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_replies_letter_idx ON public.community_letter_replies (letter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_replies_author_idx ON public.community_letter_replies (author_id, created_at DESC);

GRANT SELECT ON public.community_letter_replies TO authenticated;
GRANT ALL ON public.community_letter_replies TO service_role;
ALTER TABLE public.community_letter_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_replies_select_own ON public.community_letter_replies;
CREATE POLICY community_replies_select_own ON public.community_letter_replies
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS community_replies_select_letter_author ON public.community_letter_replies;
CREATE POLICY community_replies_select_letter_author ON public.community_letter_replies
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (SELECT 1 FROM public.community_letters l
                 WHERE l.id = community_letter_replies.letter_id AND l.author_id = auth.uid())
  );

-- ---------- 5. community_reports ----------
CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
DO $$ BEGIN
  ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_target_chk
    CHECK (target_type IN ('letter','reply','profile'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_status_chk
    CHECK (status IN ('pending','reviewing','resolved','dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS community_reports_status_idx ON public.community_reports (status, created_at DESC);

GRANT SELECT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_reports_select_own ON public.community_reports;
CREATE POLICY community_reports_select_own ON public.community_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------- 6. community_blocks ----------
CREATE TABLE IF NOT EXISTS public.community_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id)
);
CREATE INDEX IF NOT EXISTS community_blocks_blocked_idx ON public.community_blocks (blocked_user_id);

GRANT SELECT, INSERT, DELETE ON public.community_blocks TO authenticated;
GRANT ALL ON public.community_blocks TO service_role;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_blocks_own ON public.community_blocks;
CREATE POLICY community_blocks_own ON public.community_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS community_blocks_insert_own ON public.community_blocks;
CREATE POLICY community_blocks_insert_own ON public.community_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_user_id <> auth.uid());
DROP POLICY IF EXISTS community_blocks_delete_own ON public.community_blocks;
CREATE POLICY community_blocks_delete_own ON public.community_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ---------- 7. community_notifications ----------
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_notifications_user_idx
  ON public.community_notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.community_notifications TO authenticated;
GRANT ALL ON public.community_notifications TO service_role;
ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_notifications_own ON public.community_notifications;
CREATE POLICY community_notifications_own ON public.community_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS community_notifications_update_own ON public.community_notifications;
CREATE POLICY community_notifications_update_own ON public.community_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- 8. community_moderation_events ----------
CREATE TABLE IF NOT EXISTS public.community_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_type text NOT NULL,
  target_id uuid,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_moderation_events_target_idx
  ON public.community_moderation_events (target_type, target_id, created_at DESC);

GRANT SELECT ON public.community_moderation_events TO authenticated;
GRANT ALL ON public.community_moderation_events TO service_role;
ALTER TABLE public.community_moderation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_moderation_events_admin ON public.community_moderation_events;
CREATE POLICY community_moderation_events_admin ON public.community_moderation_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at triggers
DROP TRIGGER IF EXISTS community_letters_touch ON public.community_letters;
CREATE TRIGGER community_letters_touch BEFORE UPDATE ON public.community_letters
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();
DROP TRIGGER IF EXISTS community_replies_touch ON public.community_letter_replies;
CREATE TRIGGER community_replies_touch BEFORE UPDATE ON public.community_letter_replies
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

-- ============================================================
-- RPCs (SECURITY DEFINER). Clients cannot INSERT into letters /
-- deliveries / replies / reports directly (no INSERT policies).
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_community_letter(
  _subject text,
  _body text,
  _topic text,
  _target_age_band text,
  _response_style text,
  _needs_review boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _band text; _lang text; _sent int; _id uuid; _dup int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  _band := public.community_age_band(_uid);
  IF _band IS NULL THEN RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501'; END IF;
  IF _target_age_band NOT IN ('18-22','23-29','30-39','40-49','50-59','60+') THEN
    RAISE EXCEPTION 'invalid_target_age_band' USING ERRCODE = '22023';
  END IF;
  _body := btrim(_body);
  IF length(_body) < 20 OR length(_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body_length' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO _sent FROM public.community_letters
   WHERE author_id = _uid AND created_at > now() - interval '1 day';
  IF _sent >= 3 THEN RAISE EXCEPTION 'daily_letter_limit' USING ERRCODE = '53400'; END IF;

  -- replay / double-click protection
  SELECT count(*) INTO _dup FROM public.community_letters
   WHERE author_id = _uid AND body = _body AND created_at > now() - interval '10 minutes';
  IF _dup > 0 THEN RAISE EXCEPTION 'duplicate_submission' USING ERRCODE = '53400'; END IF;

  SELECT COALESCE(language, 'zh') INTO _lang FROM public.community_profiles WHERE user_id = _uid;

  INSERT INTO public.community_letters
    (author_id, subject, body, topic, target_age_band, response_style, language, status)
  VALUES (_uid, NULLIF(btrim(COALESCE(_subject,'')),''), _body,
          NULLIF(btrim(COALESCE(_topic,'')),''), _target_age_band,
          NULLIF(btrim(COALESCE(_response_style,'')),''), COALESCE(_lang,'zh'),
          CASE WHEN _needs_review THEN 'pending' ELSE 'approved' END)
  RETURNING id INTO _id;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action, notes)
  VALUES (_uid, 'letter', _id, CASE WHEN _needs_review THEN 'queued_for_review' ELSE 'auto_approved' END, NULL);

  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.dispatch_community_letter(_letter_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _existing int; _approved int; _target int; _inserted int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _l FROM public.community_letters WHERE id = _letter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;
  IF _l.author_id <> _uid AND NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _l.status <> 'approved' THEN RETURN 0; END IF;
  IF _l.expires_at <= now() THEN RETURN 0; END IF;

  SELECT count(*) INTO _approved FROM public.community_letter_replies
   WHERE letter_id = _letter_id AND status = 'approved';
  IF _approved >= 3 THEN RETURN 0; END IF;

  SELECT count(*) INTO _existing FROM public.community_letter_deliveries WHERE letter_id = _letter_id;
  IF _existing >= 12 THEN RETURN 0; END IF;
  _target := LEAST(12 - _existing, GREATEST(5 - _existing, 0) + 5);
  IF _target <= 0 THEN RETURN 0; END IF;

  WITH pool AS (
    SELECT cp.user_id,
           (SELECT max(d.delivered_at) FROM public.community_letter_deliveries d
             WHERE d.recipient_id = cp.user_id) AS last_delivery
      FROM public.community_profiles cp
     WHERE cp.opt_in = true
       AND cp.status = 'active'
       AND cp.age_band = _l.target_age_band
       AND cp.language = _l.language
       AND cp.user_id <> _l.author_id
       AND NOT EXISTS (SELECT 1 FROM public.community_letter_deliveries d
                        WHERE d.letter_id = _letter_id AND d.recipient_id = cp.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.community_blocks b
                        WHERE (b.blocker_id = _l.author_id AND b.blocked_user_id = cp.user_id)
                           OR (b.blocker_id = cp.user_id AND b.blocked_user_id = _l.author_id))
     ORDER BY last_delivery NULLS FIRST, random()
     LIMIT _target
  )
  INSERT INTO public.community_letter_deliveries (letter_id, recipient_id)
  SELECT _letter_id, user_id FROM pool
  ON CONFLICT (letter_id, recipient_id) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  INSERT INTO public.community_notifications (user_id, type, entity_id)
  SELECT d.recipient_id, 'letter_received', _letter_id
    FROM public.community_letter_deliveries d
   WHERE d.letter_id = _letter_id AND d.delivered_at > now() - interval '5 seconds';

  RETURN _inserted;
END; $$;

CREATE OR REPLACE FUNCTION public.reply_to_community_letter(
  _letter_id uuid,
  _body text,
  _needs_review boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _l record; _cnt int; _id uuid; _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF public.community_age_band(_uid) IS NULL THEN
    RAISE EXCEPTION 'adult_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT l.* INTO _l FROM public.community_letters l WHERE l.id = _letter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter_not_found' USING ERRCODE = '42501'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.community_letter_deliveries d
                  WHERE d.letter_id = _letter_id AND d.recipient_id = _uid
                    AND d.status <> 'hidden') THEN
    RAISE EXCEPTION 'not_a_recipient' USING ERRCODE = '42501';
  END IF;
  IF _l.expires_at <= now() THEN RAISE EXCEPTION 'letter_expired' USING ERRCODE = '53400'; END IF;

  _body := btrim(_body);
  IF length(_body) < 10 OR length(_body) > 3000 THEN
    RAISE EXCEPTION 'invalid_body_length' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO _cnt FROM public.community_letter_replies
   WHERE author_id = _uid AND created_at > now() - interval '1 hour';
  IF _cnt >= 10 THEN RAISE EXCEPTION 'hourly_reply_limit' USING ERRCODE = '53400'; END IF;

  IF EXISTS (SELECT 1 FROM public.community_letter_replies
              WHERE letter_id = _letter_id AND author_id = _uid AND body = _body
                AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'duplicate_submission' USING ERRCODE = '53400';
  END IF;

  _status := CASE WHEN _needs_review THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.community_letter_replies (letter_id, author_id, body, status)
  VALUES (_letter_id, _uid, _body, _status)
  RETURNING id INTO _id;

  UPDATE public.community_letter_deliveries
     SET status = 'replied', replied_at = now()
   WHERE letter_id = _letter_id AND recipient_id = _uid;

  IF _status = 'approved' THEN
    INSERT INTO public.community_notifications (user_id, type, entity_id)
    VALUES (_l.author_id, 'reply_received', _id);
  END IF;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action)
  VALUES (_uid, 'reply', _id, CASE WHEN _needs_review THEN 'queued_for_review' ELSE 'auto_approved' END);

  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_community_mailbox()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'ageBand', public.community_age_band(_uid),
    'received', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'deliveredAt' DESC) FROM (
        SELECT jsonb_build_object(
          'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
          'responseStyle', l.response_style, 'targetAgeBand', l.target_age_band,
          'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'deliveredAt', d.delivered_at, 'readAt', d.read_at, 'repliedAt', d.replied_at,
          'status', d.status,
          'author', jsonb_build_object(
            'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
            'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
        ) AS x
        FROM public.community_letter_deliveries d
        JOIN public.community_letters l ON l.id = d.letter_id
        LEFT JOIN public.community_profiles cp ON cp.user_id = l.author_id
        WHERE d.recipient_id = _uid AND d.status <> 'hidden' AND l.status = 'approved'
        ORDER BY d.delivered_at DESC LIMIT 100
      ) s
    ), '[]'::jsonb),
    'sent', COALESCE((
      SELECT jsonb_agg(y ORDER BY y->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object(
          'letterId', l.id, 'subject', l.subject, 'body', l.body, 'topic', l.topic,
          'targetAgeBand', l.target_age_band, 'status', l.status,
          'createdAt', l.created_at, 'expiresAt', l.expires_at,
          'deliveredCount', (SELECT count(*) FROM public.community_letter_deliveries d WHERE d.letter_id = l.id),
          'replyCount', (SELECT count(*) FROM public.community_letter_replies r
                          WHERE r.letter_id = l.id AND r.status = 'approved')
        ) AS y
        FROM public.community_letters l
        WHERE l.author_id = _uid
        ORDER BY l.created_at DESC LIMIT 100
      ) s2
    ), '[]'::jsonb),
    'echoes', COALESCE((
      SELECT jsonb_agg(z ORDER BY z->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object(
          'replyId', r.id, 'letterId', r.letter_id, 'body', r.body, 'createdAt', r.created_at,
          'author', jsonb_build_object(
            'alias', cp.alias, 'academy', cp.academy, 'element', cp.element,
            'avatarUrl', cp.avatar_url, 'quote', cp.quote, 'ageBand', cp.age_band)
        ) AS z
        FROM public.community_letter_replies r
        JOIN public.community_letters l ON l.id = r.letter_id
        LEFT JOIN public.community_profiles cp ON cp.user_id = r.author_id
        WHERE l.author_id = _uid AND r.status = 'approved'
        ORDER BY r.created_at DESC LIMIT 100
      ) s3
    ), '[]'::jsonb),
    'myReplies', COALESCE((
      SELECT jsonb_agg(w ORDER BY w->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('replyId', r.id, 'letterId', r.letter_id, 'body', r.body,
                                  'status', r.status, 'createdAt', r.created_at) AS w
        FROM public.community_letter_replies r
        WHERE r.author_id = _uid ORDER BY r.created_at DESC LIMIT 100
      ) s4
    ), '[]'::jsonb),
    'notifications', COALESCE((
      SELECT jsonb_agg(n ORDER BY n->>'createdAt' DESC) FROM (
        SELECT jsonb_build_object('id', nt.id, 'type', nt.type, 'entityId', nt.entity_id,
                                  'readAt', nt.read_at, 'createdAt', nt.created_at) AS n
        FROM public.community_notifications nt
        WHERE nt.user_id = _uid ORDER BY nt.created_at DESC LIMIT 50
      ) s5
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END; $$;

CREATE OR REPLACE FUNCTION public.report_community_content(
  _target_type text,
  _target_id uuid,
  _reason text,
  _details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _cnt int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF _target_type NOT IN ('letter','reply','profile') THEN
    RAISE EXCEPTION 'invalid_target_type' USING ERRCODE = '22023';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 OR length(_reason) > 60 THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '22023';
  END IF;
  IF _details IS NOT NULL AND length(_details) > 1000 THEN
    RAISE EXCEPTION 'invalid_details' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO _cnt FROM public.community_reports
   WHERE reporter_id = _uid AND created_at > now() - interval '1 hour';
  IF _cnt >= 10 THEN RAISE EXCEPTION 'hourly_report_limit' USING ERRCODE = '53400'; END IF;

  INSERT INTO public.community_reports (reporter_id, target_type, target_id, reason, details)
  VALUES (_uid, _target_type, _target_id, btrim(_reason), NULLIF(btrim(COALESCE(_details,'')),''))
  RETURNING id INTO _id;

  INSERT INTO public.community_moderation_events (actor_id, target_type, target_id, action)
  VALUES (_uid, _target_type, _target_id, 'reported');

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.dispatch_community_letter(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_my_community_mailbox() FROM public, anon;
REVOKE ALL ON FUNCTION public.report_community_content(text,uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_community_letter(text,text,text,text,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_community_letter(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reply_to_community_letter(uuid,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_community_mailbox() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_community_content(text,uuid,text,text) TO authenticated, service_role;