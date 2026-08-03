
ALTER TABLE public.redemption_codes
  ADD COLUMN IF NOT EXISTS assigned_email TEXT;

CREATE INDEX IF NOT EXISTS idx_redemption_codes_assigned_email
  ON public.redemption_codes (lower(assigned_email))
  WHERE assigned_email IS NOT NULL;

-- admin_create_redemption_code: add optional _assigned_email at end
CREATE OR REPLACE FUNCTION public.admin_create_redemption_code(
  _code_hash text, _code_prefix text, _code_last4 text,
  _benefit_type text, _duration_days integer, _max_redemptions integer,
  _starts_at timestamp with time zone, _expires_at timestamp with time zone,
  _report_scope text, _campaign_name text, _internal_note text,
  _assigned_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _norm_email text;
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

  _norm_email := NULLIF(lower(btrim(COALESCE(_assigned_email, ''))), '');
  IF _norm_email IS NOT NULL AND _norm_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_assigned_email';
  END IF;

  INSERT INTO public.redemption_codes (
    code_hash, code_prefix, code_last4, benefit_type, duration_days,
    max_redemptions, starts_at, expires_at, report_scope,
    campaign_name, internal_note, created_by, assigned_email
  ) VALUES (
    _code_hash, _code_prefix, _code_last4, _benefit_type,
    CASE WHEN _benefit_type IN ('sage_membership','oracle_membership') THEN _duration_days ELSE NULL END,
    GREATEST(1, COALESCE(_max_redemptions, 1)),
    _starts_at, _expires_at,
    CASE WHEN _benefit_type = 'premium_report' THEN COALESCE(_report_scope, 'current_chart') ELSE NULL END,
    _campaign_name, _internal_note, _uid, _norm_email
  ) RETURNING id INTO _new_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES (_uid, 'redemption_code.create', 'redemption_code', _new_id::text,
    jsonb_build_object('benefit_type', _benefit_type, 'max_redemptions', _max_redemptions,
                       'duration_days', _duration_days, 'campaign_name', _campaign_name,
                       'assigned_email', _norm_email));

  RETURN _new_id;
END;
$function$;

-- admin_list_redemption_codes: include assigned_email in output
DROP FUNCTION IF EXISTS public.admin_list_redemption_codes(text, text, text, integer);
CREATE OR REPLACE FUNCTION public.admin_list_redemption_codes(
  _benefit_type text DEFAULT NULL, _status text DEFAULT NULL,
  _campaign_name text DEFAULT NULL, _limit integer DEFAULT 200
) RETURNS TABLE(
  id uuid, code_prefix text, code_last4 text, benefit_type text, duration_days integer,
  report_scope text, max_redemptions integer, redemption_count integer,
  starts_at timestamp with time zone, expires_at timestamp with time zone,
  status text, campaign_name text, internal_note text,
  created_by uuid, created_at timestamp with time zone, assigned_email text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.code_prefix, c.code_last4, c.benefit_type, c.duration_days, c.report_scope,
           c.max_redemptions, c.redemption_count, c.starts_at, c.expires_at, c.status,
           c.campaign_name, c.internal_note, c.created_by, c.created_at, c.assigned_email
      FROM public.redemption_codes c
     WHERE (_benefit_type IS NULL OR c.benefit_type = _benefit_type)
       AND (_status IS NULL OR c.status = _status)
       AND (_campaign_name IS NULL OR c.campaign_name = _campaign_name)
     ORDER BY c.created_at DESC
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 500));
END;
$function$;

-- redeem_code: enforce assigned_email
CREATE OR REPLACE FUNCTION public.redeem_code(
  _code_hash text, _code_prefix text, _chart_id uuid,
  _request_id text, _ip_hash text, _user_agent_summary text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  _caller_email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR length(_request_id) < 8 OR length(_request_id) > 80 THEN
    RAISE EXCEPTION 'invalid_request_id';
  END IF;

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

  SELECT * INTO _code FROM public.redemption_codes
    WHERE code_hash = _code_hash FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'code_invalid', _ip_hash, 'code_invalid');
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = '42704';
  END IF;

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

  -- Assigned-email gate
  IF _code.assigned_email IS NOT NULL THEN
    SELECT lower(email) INTO _caller_email FROM public.profiles WHERE id = _uid;
    IF _caller_email IS DISTINCT FROM lower(_code.assigned_email) THEN
      INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
      VALUES (_uid, _code_prefix, 'code_not_assigned_to_you', _ip_hash, 'code_not_assigned_to_you');
      RAISE EXCEPTION 'code_not_assigned_to_you';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redemption_uses
     WHERE redemption_code_id = _code.id AND user_id = _uid AND status = 'fulfilled'
  ) THEN
    INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
    VALUES (_uid, _code_prefix, 'already_redeemed_by_user', _ip_hash, 'already_redeemed_by_user');
    RAISE EXCEPTION 'already_redeemed_by_user';
  END IF;

  IF _code.benefit_type = 'premium_report' THEN
    IF _chart_id IS NULL THEN
      RAISE EXCEPTION 'chart_required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.charts WHERE id = _chart_id AND user_id = _uid) THEN
      INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
      VALUES (_uid, _code_prefix, 'chart_not_owned', _ip_hash, 'chart_not_owned');
      RAISE EXCEPTION 'chart_not_owned';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.premium_report_orders
       WHERE user_id = _uid AND chart_id = _chart_id AND status = 'paid'
    ) THEN
      INSERT INTO public.redemption_attempts (user_id, code_prefix, outcome, ip_hash, error_code)
      VALUES (_uid, _code_prefix, 'report_already_owned', _ip_hash, 'report_already_owned');
      RAISE EXCEPTION 'report_already_owned';
    END IF;
  END IF;

  INSERT INTO public.redemption_uses (
    redemption_code_id, user_id, benefit_type, chart_id, status, request_id, ip_hash, user_agent_summary
  ) VALUES (
    _code.id, _uid, _code.benefit_type, _chart_id, 'processing', _request_id, _ip_hash, _user_agent_summary
  ) RETURNING id INTO _use_id;

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
      ELSE
        _tier := 'sage'; _days := COALESCE(_code.duration_days, 30);
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
$function$;
