
-- 1. Add started_at column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_started_at timestamp with time zone;

-- 2. Guard trigger: only service_role / admin / marker session var may write tier/expiry.
CREATE OR REPLACE FUNCTION public.profiles_membership_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _marker text := current_setting('app.membership_writer', true);
  _is_admin boolean := false;
BEGIN
  IF (NEW.membership_tier IS DISTINCT FROM OLD.membership_tier)
     OR (NEW.membership_expires_at IS DISTINCT FROM OLD.membership_expires_at)
     OR (NEW.membership_started_at IS DISTINCT FROM OLD.membership_started_at) THEN

    IF _marker = 'on' THEN
      RETURN NEW;
    END IF;

    BEGIN
      _is_admin := private.has_role(auth.uid(), 'admin'::public.app_role);
    EXCEPTION WHEN OTHERS THEN
      _is_admin := false;
    END;
    IF _is_admin THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'membership_columns_readonly'
      USING ERRCODE = '42501',
            HINT = 'Membership tier/expiry/started_at can only be changed by simulate_mock_membership_upgrade or an admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_membership_write_guard ON public.profiles;
CREATE TRIGGER profiles_membership_write_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_membership_write_guard();

-- 3. membership_orders table
CREATE TABLE IF NOT EXISTS public.membership_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_tier text NOT NULL CHECK (target_tier IN ('sage','oracle')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'CNY',
  payment_method text NOT NULL CHECK (payment_method IN ('wechat','alipay','visa','unionpay')),
  provider text NOT NULL DEFAULT 'mock',
  provider_order_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','failed','refunded')),
  previous_tier text NOT NULL,
  previous_expires_at timestamp with time zone,
  granted_started_at timestamp with time zone NOT NULL,
  granted_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

GRANT SELECT ON public.membership_orders TO authenticated;
GRANT ALL ON public.membership_orders TO service_role;
ALTER TABLE public.membership_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_orders_select_own" ON public.membership_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "membership_orders_select_admin" ON public.membership_orders
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS membership_orders_user_created_idx
  ON public.membership_orders (user_id, created_at DESC);

CREATE TRIGGER membership_orders_touch
  BEFORE UPDATE ON public.membership_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Atomic RPC
CREATE OR REPLACE FUNCTION public.simulate_mock_membership_upgrade(
  _target_tier text,
  _payment_method text,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _now timestamp with time zone := now();
  _existing_order public.membership_orders%ROWTYPE;
  _prev_tier public.membership_tier;
  _prev_expires timestamp with time zone;
  _effective_tier public.membership_tier;
  _base_ts timestamp with time zone;
  _new_expires timestamp with time zone;
  _amount_cents integer;
  _provider_order_id text := 'mock_' || replace(gen_random_uuid()::text,'-','');
  _final_tier public.membership_tier;
  _final_expires timestamp with time zone;
  _final_started timestamp with time zone;
  _order_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _target_tier NOT IN ('sage','oracle') THEN
    RAISE EXCEPTION 'invalid_target_tier';
  END IF;
  IF _payment_method NOT IN ('wechat','alipay','visa','unionpay') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 OR length(_idempotency_key) > 80 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  -- Idempotency: return existing order for the same key.
  SELECT * INTO _existing_order
    FROM public.membership_orders
    WHERE user_id = _uid AND idempotency_key = _idempotency_key
    LIMIT 1;
  IF FOUND THEN
    SELECT membership_tier, membership_expires_at, membership_started_at
      INTO _final_tier, _final_expires, _final_started
      FROM public.profiles WHERE id = _uid;
    RETURN jsonb_build_object(
      'idempotent', true,
      'order', to_jsonb(_existing_order),
      'membership', jsonb_build_object(
        'tier', _final_tier,
        'expires_at', _final_expires,
        'started_at', _final_started
      )
    );
  END IF;

  -- Server-side price table.
  _amount_cents := CASE _target_tier
    WHEN 'sage' THEN 1990   -- ¥19.9
    WHEN 'oracle' THEN 3990 -- ¥39.9
  END;

  -- Load current state.
  SELECT membership_tier, membership_expires_at
    INTO _prev_tier, _prev_expires
    FROM public.profiles WHERE id = _uid
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  -- Treat expired paid tier as effectively 'none'.
  _effective_tier := _prev_tier;
  IF _prev_tier IN ('sage','oracle') AND (_prev_expires IS NULL OR _prev_expires <= _now) THEN
    _effective_tier := 'none';
  END IF;

  -- Extend from later of now / current expiry (only if same-or-lower tier upgrade preserves remaining time).
  _base_ts := GREATEST(_now, COALESCE(_prev_expires, _now));
  _new_expires := _base_ts + interval '1 month';

  -- Decide final tier: never downgrade Oracle -> Sage.
  IF _effective_tier = 'oracle' AND _target_tier = 'sage' THEN
    _final_tier := 'oracle';
    -- Still extend expiry.
    _final_expires := _new_expires;
  ELSE
    _final_tier := _target_tier::public.membership_tier;
    _final_expires := _new_expires;
  END IF;

  -- Insert order first for idempotency uniqueness lock.
  INSERT INTO public.membership_orders (
    user_id, target_tier, amount_cents, currency, payment_method,
    provider, provider_order_id, idempotency_key, status,
    previous_tier, previous_expires_at, granted_started_at, granted_expires_at
  ) VALUES (
    _uid, _target_tier, _amount_cents, 'CNY', _payment_method,
    'mock', _provider_order_id, _idempotency_key, 'paid',
    _prev_tier::text, _prev_expires, _now, _final_expires
  ) RETURNING id INTO _order_id;

  -- Flip marker and update profile atomically inside same tx.
  PERFORM set_config('app.membership_writer', 'on', true);
  UPDATE public.profiles
    SET membership_tier = _final_tier,
        membership_expires_at = _final_expires,
        membership_started_at = COALESCE(membership_started_at, _now),
        updated_at = _now
    WHERE id = _uid;
  PERFORM set_config('app.membership_writer', 'off', true);

  SELECT membership_started_at INTO _final_started FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object(
    'idempotent', false,
    'order', (SELECT to_jsonb(mo) FROM public.membership_orders mo WHERE id = _order_id),
    'membership', jsonb_build_object(
      'tier', _final_tier,
      'expires_at', _final_expires,
      'started_at', _final_started
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_mock_membership_upgrade(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.simulate_mock_membership_upgrade(text, text, text) TO authenticated;
