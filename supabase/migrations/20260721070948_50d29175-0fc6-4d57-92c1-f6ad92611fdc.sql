
ALTER TABLE public.charts
  ADD COLUMN IF NOT EXISTS chart_role text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

ALTER TABLE public.charts
  DROP CONSTRAINT IF EXISTS charts_chart_role_check;
ALTER TABLE public.charts
  ADD CONSTRAINT charts_chart_role_check CHECK (chart_role IN ('self','other'));

ALTER TABLE public.charts
  DROP CONSTRAINT IF EXISTS charts_primary_requires_self;
ALTER TABLE public.charts
  ADD CONSTRAINT charts_primary_requires_self CHECK (is_primary = false OR chart_role = 'self');

CREATE UNIQUE INDEX IF NOT EXISTS charts_one_primary_per_user
  ON public.charts(user_id) WHERE is_primary = true;

-- Atomically promote a chart to the account's primary self chart. Clears any
-- existing primary for the same user in the same transaction so the partial
-- unique index never blocks the swap. Owner-scoped via auth.uid().
CREATE OR REPLACE FUNCTION public.set_primary_chart(_chart_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _updated int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.charts WHERE id = _chart_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'chart_not_found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.charts
     SET is_primary = false
   WHERE user_id = _uid AND is_primary = true AND id <> _chart_id;

  UPDATE public.charts
     SET is_primary = true,
         chart_role = 'self'
   WHERE id = _chart_id AND user_id = _uid;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_primary_chart(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_chart(uuid) TO authenticated;

-- Owner-only role setter. Callers cannot demote themselves out of primary
-- while trying to become 'other' — enforce that here so the check constraint
-- never rejects the update.
CREATE OR REPLACE FUNCTION public.set_chart_role(_chart_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _role NOT IN ('self','other') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.charts WHERE id = _chart_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'chart_not_found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.charts
     SET chart_role = _role,
         is_primary = CASE WHEN _role = 'other' THEN false ELSE is_primary END
   WHERE id = _chart_id AND user_id = _uid;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_chart_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_chart_role(uuid, text) TO authenticated;
