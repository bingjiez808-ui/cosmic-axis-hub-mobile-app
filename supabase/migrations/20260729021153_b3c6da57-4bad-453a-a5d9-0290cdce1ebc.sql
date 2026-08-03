-- ============================================================
-- 兑换码系统 · 权益交付统一化
-- ============================================================

-- ---------- 0. 放宽已有 membership_orders 支付方式（允许 redemption/grant 来源） ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'membership_orders_payment_method_check'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.membership_orders DROP CONSTRAINT membership_orders_payment_method_check;
  END IF;
END $$;

ALTER TABLE public.membership_orders
  ADD CONSTRAINT membership_orders_payment_method_check
  CHECK (payment_method IN ('wechat','alipay','visa','unionpay','redemption','grant'));

-- ---------- 1. 抽取公共权益授予函数 ----------
-- 会员顺延 + 不降级 + 写 membership_orders + 更新 profile
-- simulate_mock_membership_upgrade 与新 redeem_code 都调用此函数
CREATE OR REPLACE FUNCTION public.apply_membership_grant(
  _user_id uuid,
  _target_tier text,
  _duration_days integer,
  _payment_method text,
  _provider text,
  _idempotency_key text,
  _amount_cents integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _existing public.membership_orders%ROWTYPE;
  _prev_tier public.membership_tier;
  _prev_expires timestamptz;
  _effective_tier public.membership_tier;
  _base_ts timestamptz;
  _new_expires timestamptz;
  _final_tier public.membership_tier;
  _final_started timestamptz;
  _order_id uuid;
  _provider_order_id text := _provider || '_' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF _target_tier NOT IN ('sage','oracle') THEN
    RAISE EXCEPTION 'invalid_target_tier';
  END IF;
  IF _duration_days IS NULL OR _duration_days < 1 OR _duration_days > 3650 THEN
    RAISE EXCEPTION 'invalid_duration_days';
  END IF;

  -- 幂等：同 user+idempotency_key 已存在则直接返回
  SELECT * INTO _existing
    FROM public.membership_orders
   WHERE user_id = _user_id AND idempotency_key = _idempotency_key
   LIMIT 1;
  IF FOUND THEN
    SELECT membership_tier, membership_expires_at, membership_started_at
      INTO _final_tier, _new_expires, _final_started
      FROM public.profiles WHERE id = _user_id;
    RETURN jsonb_build_object(
      'idempotent', true,
      'order_id', _existing.id,
      'tier', _final_tier,
      'expires_at', _new_expires,
      'started_at', _final_started
    );
  END IF;

  SELECT membership_tier, membership_expires_at
    INTO _prev_tier, _prev_expires
    FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  _effective_tier := _prev_tier;
  IF _prev_tier IN ('sage','oracle') AND (_prev_expires IS NULL OR _prev_expires <= _now) THEN
    _effective_tier := 'none';
  END IF;

  _base_ts := GREATEST(_now, COALESCE(_prev_expires, _now));
  _new_expires := _base_ts + make_interval(days => _duration_days);

  -- 不降级：Oracle 有效期内兑换 Sage → 保留 Oracle tier，但延长到期时间
  IF _effective_tier = 'oracle' AND _target_tier = 'sage' THEN
    _final_tier := 'oracle';
  ELSE
    _final_tier := _target_tier::public.membership_tier;
  END IF;

  INSERT INTO public.membership_orders (
    user_id, target_tier, amount_cents, currency, payment_method,
    provider, provider_order_id, idempotency_key, status,
    previous_tier, previous_expires_at, granted_started_at, granted_expires_at
  ) VALUES (
    _user_id, _target_tier, _amount_cents, 'CNY', _payment_method,
    _provider, _provider_order_id, _idempotency_key, 'paid',
    _prev_tier::text, _prev_expires, _now, _new_expires
  ) RETURNING id INTO _order_id;

  PERFORM set_config('app.membership_writer', 'on', true);
  UPDATE public.profiles
     SET membership_tier = _final_tier,
         membership_expires_at = _new_expires,
         membership_started_at = COALESCE(membership_started_at, _now),
         updated_at = _now
   WHERE id = _user_id;
  PERFORM set_config('app.membership_writer', 'off', true);

  SELECT membership_started_at INTO _final_started FROM public.profiles WHERE id = _user_id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'order_id', _order_id,
    'tier', _final_tier,
    'expires_at', _new_expires,
    'started_at', _final_started
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_membership_grant(uuid, text, integer, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_membership_grant(uuid, text, integer, text, text, text, integer) TO service_role;

-- 更新 simulate_mock_membership_upgrade 让其复用 apply_membership_grant
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
  _amount_cents integer;
  _result jsonb;
  _order jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _payment_method NOT IN ('wechat','alipay','visa','unionpay') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 OR length(_idempotency_key) > 80 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  _amount_cents := CASE _target_tier
    WHEN 'sage' THEN 1990
    WHEN 'oracle' THEN 3990
    ELSE 0
  END;

  _result := public.apply_membership_grant(
    _uid, _target_tier, 30, _payment_method, 'mock', _idempotency_key, _amount_cents
  );

  SELECT to_jsonb(mo) INTO _order
    FROM public.membership_orders mo
    WHERE mo.id = (_result->>'order_id')::uuid;

  RETURN jsonb_build_object(
    'idempotent', (_result->>'idempotent')::boolean,
    'order', _order,
    'membership', jsonb_build_object(
      'tier', _result->>'tier',
      'expires_at', _result->>'expires_at',
      'started_at', _result->>'started_at'
    )
  );
END;
$$;

-- ---------- 2. redemption_codes 表 ----------
CREATE TABLE public.redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_prefix text NOT NULL,
  code_last4 text NOT NULL,
  benefit_type text NOT NULL CHECK (benefit_type IN (
    'sage_membership','oracle_membership','premium_report','test_access','support_compensation'
  )),
  duration_days integer NULL CHECK (duration_days IS NULL OR (duration_days BETWEEN 1 AND 3650)),
  report_scope text NULL CHECK (report_scope IS NULL OR report_scope IN ('current_chart','next_selected_chart')),
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions BETWEEN 1 AND 100000),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  starts_at timestamptz NULL,
  expires_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','exhausted','expired')),
  campaign_name text NULL,
  internal_note text NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_by uuid NULL REFERENCES auth.users(id),
  disabled_at timestamptz NULL
);
CREATE INDEX redemption_codes_benefit_type_idx ON public.redemption_codes (benefit_type);
CREATE INDEX redemption_codes_status_idx ON public.redemption_codes (status);
CREATE INDEX redemption_codes_campaign_idx ON public.redemption_codes (campaign_name);
CREATE INDEX redemption_codes_created_at_idx ON public.redemption_codes (created_at DESC);

-- 兑换码本体：普通用户完全不可读
GRANT ALL ON public.redemption_codes TO service_role;

ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redemption_codes_service_only_select"
  ON public.redemption_codes FOR SELECT
  TO service_role
  USING (true);
CREATE POLICY "redemption_codes_service_only_insert"
  ON public.redemption_codes FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "redemption_codes_service_only_update"
  ON public.redemption_codes FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- ---------- 3. redemption_uses 表 ----------
CREATE TABLE public.redemption_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_code_id uuid NOT NULL REFERENCES public.redemption_codes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_type text NOT NULL,
  chart_id uuid NULL,
  order_id uuid NULL,
  status text NOT NULL CHECK (status IN ('processing','fulfilled','failed','reversed')),
  entitlement_id text NULL,
  failure_code text NULL,
  request_id text NOT NULL,
  ip_hash text NULL,
  user_agent_summary text NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz NULL,
  UNIQUE (user_id, request_id)
);
CREATE INDEX redemption_uses_code_idx ON public.redemption_uses (redemption_code_id);
CREATE INDEX redemption_uses_user_idx ON public.redemption_uses (user_id, redeemed_at DESC);
CREATE UNIQUE INDEX redemption_uses_unique_fulfilled_per_user
  ON public.redemption_uses (redemption_code_id, user_id)
  WHERE status = 'fulfilled';

GRANT SELECT ON public.redemption_uses TO authenticated;
GRANT ALL ON public.redemption_uses TO service_role;

ALTER TABLE public.redemption_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redemption_uses_owner_select"
  ON public.redemption_uses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------- 4. redemption_attempts 表 ----------
CREATE TABLE public.redemption_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  code_prefix text NULL,
  outcome text NOT NULL,
  ip_hash text NULL,
  rate_limited boolean NOT NULL DEFAULT false,
  error_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX redemption_attempts_user_time_idx ON public.redemption_attempts (user_id, created_at DESC);
CREATE INDEX redemption_attempts_ip_time_idx ON public.redemption_attempts (ip_hash, created_at DESC);

GRANT ALL ON public.redemption_attempts TO service_role;

ALTER TABLE public.redemption_attempts ENABLE ROW LEVEL SECURITY;
-- No authenticated policies. Service role bypasses RLS.

-- ---------- 5. admin_audit_logs 表 ----------
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NULL,
  target_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_logs_admin_time_idx ON public.admin_audit_logs (admin_user_id, created_at DESC);
CREATE INDEX admin_audit_logs_action_idx ON public.admin_audit_logs (action);

GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
-- No authenticated policies. Service role bypasses RLS.

-- ---------- 6. 管理员 RPCs ----------

-- 创建单个兑换码（quantity 由服务端函数循环调用）
CREATE OR REPLACE FUNCTION public.admin_create_redemption_code(
  _code_hash text,
  _code_prefix text,
  _code_last4 text,
  _benefit_type text,
  _duration_days integer,
  _max_redemptions integer,
  _starts_at timestamptz,
  _expires_at timestamptz,
  _report_scope text,
  _campaign_name text,
  _internal_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  IF _benefit_type NOT IN ('sage_membership','oracle_membership','premium_report','test_access','support_compensation') THEN
    RAISE EXCEPTION 'invalid_benefit_type';
  END IF;
  IF _benefit_type IN ('sage_membership','oracle_membership') AND (_duration_days IS NULL OR _duration_days < 1) THEN
    RAISE EXCEPTION 'duration_required_for_membership';
  END IF;

  INSERT INTO public.redemption_codes (
    code_hash, code_prefix, code_last4, benefit_type, duration_days,
    max_redemptions, starts_at, expires_at, report_scope,
    campaign_name, internal_note, created_by
  ) VALUES (
    _code_hash, _code_prefix, _code_last4, _benefit_type,
    CASE WHEN _benefit_type IN ('sage_membership','oracle_membership') THEN _duration_days ELSE NULL END,
    GREATEST(1, COALESCE(_max_redemptions, 1)),
    _starts_at, _expires_at,
    CASE WHEN _benefit_type = 'premium_report' THEN COALESCE(_report_scope, 'current_chart') ELSE NULL END,
    _campaign_name, _internal_note, _uid
  ) RETURNING id INTO _new_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (_uid, 'redemption_code.create', 'redemption_code', _new_id::text,
    jsonb_build_object('benefit_type', _benefit_type, 'max_redemptions', _max_redemptions,
                       'duration_days', _duration_days, 'campaign_name', _campaign_name));

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_redemption_code(text,text,text,text,integer,integer,timestamptz,timestamptz,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_redemption_code(text,text,text,text,integer,integer,timestamptz,timestamptz,text,text,text) TO authenticated, service_role;

-- 禁用兑换码
CREATE OR REPLACE FUNCTION public.admin_disable_redemption_code(_code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.redemption_codes
     SET status = 'disabled', disabled_by = _uid, disabled_at = now()
   WHERE id = _code_id AND status IN ('active');
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_type, target_id)
  VALUES (_uid, 'redemption_code.disable', 'redemption_code', _code_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_disable_redemption_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_disable_redemption_code(uuid) TO authenticated, service_role;

-- 管理员列表（脱敏，返回明文以外的元数据）
CREATE OR REPLACE FUNCTION public.admin_list_redemption_codes(
  _benefit_type text DEFAULT NULL,
  _status text DEFAULT NULL,
  _campaign_name text DEFAULT NULL,
  _limit integer DEFAULT 200
) RETURNS TABLE (
  id uuid,
  code_prefix text,
  code_last4 text,
  benefit_type text,
  duration_days integer,
  report_scope text,
  max_redemptions integer,
  redemption_count integer,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  campaign_name text,
  internal_note text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.code_prefix, c.code_last4, c.benefit_type, c.duration_days, c.report_scope,
           c.max_redemptions, c.redemption_count, c.starts_at, c.expires_at, c.status,
           c.campaign_name, c.internal_note, c.created_by, c.created_at
      FROM public.redemption_codes c
     WHERE (_benefit_type IS NULL OR c.benefit_type = _benefit_type)
       AND (_status IS NULL OR c.status = _status)
       AND (_campaign_name IS NULL OR c.campaign_name = _campaign_name)
     ORDER BY c.created_at DESC
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_redemption_codes(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_redemption_codes(text,text,text,integer) TO authenticated, service_role;

-- 管理员查看兑换记录
CREATE OR REPLACE FUNCTION public.admin_list_redemption_uses(
  _code_id uuid DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _limit integer DEFAULT 200
) RETURNS TABLE (
  id uuid,
  redemption_code_id uuid,
  code_prefix text,
  code_last4 text,
  benefit_type text,
  user_id uuid,
  user_email text,
  chart_id uuid,
  order_id uuid,
  status text,
  entitlement_id text,
  failure_code text,
  redeemed_at timestamptz,
  fulfilled_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.redemption_code_id, c.code_prefix, c.code_last4, u.benefit_type,
           u.user_id, p.email, u.chart_id, u.order_id, u.status, u.entitlement_id,
           u.failure_code, u.redeemed_at, u.fulfilled_at
      FROM public.redemption_uses u
      JOIN public.redemption_codes c ON c.id = u.redemption_code_id
      LEFT JOIN public.profiles p ON p.id = u.user_id
     WHERE (_code_id IS NULL OR u.redemption_code_id = _code_id)
       AND (_user_id IS NULL OR u.user_id = _user_id)
     ORDER BY u.redeemed_at DESC
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_redemption_uses(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_redemption_uses(uuid,uuid,integer) TO authenticated, service_role;

-- ---------- 7. 用户兑换 RPC ----------
CREATE OR REPLACE FUNCTION public.redeem_code(
  _code_hash text,
  _code_prefix text,
  _chart_id uuid,
  _request_id text,
  _ip_hash text,
  _user_agent_summary text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code public.redemption_codes%ROWTYPE;
  _now timestamptz := now();
  _existing_use public.redemption_uses%ROWTYPE;
  _use_id uuid;
  _grant jsonb;
  _order_id uuid;
  _entitlement_id text;
  _final_membership jsonb := NULL;
  _final_report jsonb := NULL;
  _report_provider_order text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR length(_request_id) < 8 OR length(_request_id) > 80 THEN
    RAISE EXCEPTION 'invalid_request_id';
  END IF;

  -- 幂等：相同 (user_id, request_id) 已存在 → 返回原结果
  SELECT * INTO _existing_use FROM public.redemption_uses
    WHERE user_id = _uid AND request_id = _request_id
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'status', _existing_use.status,
      'benefit_type', _existing_use.benefit_type,
      'entitlement_id', _existing_use.entitlement_id,
      'chart_id', _existing_use.chart_id,
      'failure_code', _existing_use.failure_code
    );
  END IF;

  -- 锁定兑换码行
  SELECT * INTO _code FROM public.redemption_codes
    WHERE code_hash = _code_hash FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_invalid', _ip_hash, 'code_invalid');
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = '42704';
  END IF;

  -- 状态与时窗检查
  IF _code.status = 'disabled' THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_invalid', _ip_hash, 'code_invalid');
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = '42704';
  END IF;
  IF _code.starts_at IS NOT NULL AND _code.starts_at > _now THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_not_yet_active', _ip_hash, 'code_not_yet_active');
    RAISE EXCEPTION 'code_not_yet_active';
  END IF;
  IF _code.expires_at IS NOT NULL AND _code.expires_at <= _now THEN
    UPDATE public.redemption_codes SET status='expired' WHERE id=_code.id AND status='active';
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_expired', _ip_hash, 'code_expired');
    RAISE EXCEPTION 'code_expired';
  END IF;
  IF _code.redemption_count >= _code.max_redemptions THEN
    UPDATE public.redemption_codes SET status='exhausted' WHERE id=_code.id AND status='active';
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_exhausted', _ip_hash, 'code_exhausted');
    RAISE EXCEPTION 'code_exhausted';
  END IF;
  -- 同用户去重
  IF EXISTS (
    SELECT 1 FROM public.redemption_uses
     WHERE redemption_code_id = _code.id AND user_id = _uid AND status = 'fulfilled'
  ) THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'already_redeemed_by_user', _ip_hash, 'already_redeemed_by_user');
    RAISE EXCEPTION 'already_redeemed_by_user';
  END IF;

  -- 报告类：chart 归属检查
  IF _code.benefit_type = 'premium_report' THEN
    IF _chart_id IS NULL THEN
      RAISE EXCEPTION 'chart_required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.charts WHERE id = _chart_id AND user_id = _uid) THEN
      INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
      VALUES (_uid, _code_prefix, 'chart_not_owned', _ip_hash, 'chart_not_owned');
      RAISE EXCEPTION 'chart_not_owned';
    END IF;
    -- 已购不消耗
    IF EXISTS (
      SELECT 1 FROM public.premium_report_orders
       WHERE user_id = _uid AND chart_id = _chart_id AND status = 'paid'
    ) THEN
      INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
      VALUES (_uid, _code_prefix, 'report_already_owned', _ip_hash, 'report_already_owned');
      RAISE EXCEPTION 'report_already_owned';
    END IF;
  END IF;

  -- 创建 processing 记录
  INSERT INTO public.redemption_uses (
    redemption_code_id, user_id, benefit_type, chart_id, status, request_id, ip_hash, user_agent_summary
  ) VALUES (
    _code.id, _uid, _code.benefit_type, _chart_id, 'processing', _request_id, _ip_hash, _user_agent_summary
  ) RETURNING id INTO _use_id;

  -- 分派权益
  IF _code.benefit_type IN ('sage_membership','oracle_membership','test_access','support_compensation') THEN
    DECLARE
      _tier text;
      _days integer;
    BEGIN
      IF _code.benefit_type = 'oracle_membership' THEN
        _tier := 'oracle'; _days := COALESCE(_code.duration_days, 30);
      ELSIF _code.benefit_type = 'sage_membership' THEN
        _tier := 'sage'; _days := COALESCE(_code.duration_days, 30);
      ELSIF _code.benefit_type = 'test_access' THEN
        _tier := 'oracle'; _days := COALESCE(_code.duration_days, 30);
      ELSE -- support_compensation
        _tier := COALESCE(NULLIF((SELECT lower(NULL)),''), 'sage'); _days := COALESCE(_code.duration_days, 30);
      END IF;
      _grant := public.apply_membership_grant(
        _uid, _tier, _days, 'redemption', 'redemption', 'rd_' || _use_id::text, 0
      );
      _order_id := (_grant->>'order_id')::uuid;
      _entitlement_id := _order_id::text;
      _final_membership := jsonb_build_object(
        'tier', _grant->>'tier',
        'expires_at', _grant->>'expires_at',
        'started_at', _grant->>'started_at'
      );
    END;

  ELSIF _code.benefit_type = 'premium_report' THEN
    _report_provider_order := 'redemption_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.premium_report_orders (
      user_id, chart_id, product_version, amount_cents, currency,
      status, provider, provider_order_id, paid_at, grant_note
    ) VALUES (
      _uid, _chart_id, 'premium_deep_report_v1', 0, 'CNY',
      'paid', 'redemption', _report_provider_order, _now,
      'redemption:' || _code.code_prefix || '****' || _code.code_last4
    ) RETURNING id INTO _order_id;
    _entitlement_id := _order_id::text;
    _final_report := jsonb_build_object('order_id', _order_id, 'chart_id', _chart_id);
  END IF;

  -- 标记完成 + 增计数
  UPDATE public.redemption_uses
     SET status = 'fulfilled', order_id = _order_id, entitlement_id = _entitlement_id, fulfilled_at = now()
   WHERE id = _use_id;

  UPDATE public.redemption_codes
     SET redemption_count = redemption_count + 1,
         status = CASE WHEN redemption_count + 1 >= max_redemptions THEN 'exhausted' ELSE status END
   WHERE id = _code.id;

  INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash)
  VALUES (_uid, _code_prefix, 'fulfilled', _ip_hash);

  RETURN jsonb_build_object(
    'idempotent', false,
    'status', 'fulfilled',
    'benefit_type', _code.benefit_type,
    'entitlement_id', _entitlement_id,
    'chart_id', _chart_id,
    'membership', _final_membership,
    'report', _final_report,
    'code_prefix', _code.code_prefix,
    'code_last4', _code.code_last4,
    'expires_at', _code.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_code(text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_code(text,text,uuid,text,text,text) TO authenticated, service_role;

-- ---------- 8. 用户查看自己的兑换记录（含脱敏码前缀） ----------
CREATE OR REPLACE FUNCTION public.list_my_redemption_uses()
RETURNS TABLE (
  id uuid,
  benefit_type text,
  code_prefix text,
  code_last4 text,
  chart_id uuid,
  order_id uuid,
  status text,
  redeemed_at timestamptz,
  fulfilled_at timestamptz,
  duration_days integer,
  campaign_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.benefit_type, c.code_prefix, c.code_last4, u.chart_id, u.order_id,
           u.status, u.redeemed_at, u.fulfilled_at, c.duration_days, c.campaign_name
      FROM public.redemption_uses u
      JOIN public.redemption_codes c ON c.id = u.redemption_code_id
     WHERE u.user_id = auth.uid()
     ORDER BY u.redeemed_at DESC
     LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_redemption_uses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_redemption_uses() TO authenticated, service_role;
