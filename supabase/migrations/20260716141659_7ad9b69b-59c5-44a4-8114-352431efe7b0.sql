
-- Premium report orders: one-time ¥99 unlock per user+chart+product_version.
CREATE TABLE public.premium_report_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id uuid NOT NULL REFERENCES public.charts(id) ON DELETE CASCADE,
  product_version text NOT NULL DEFAULT 'premium_pdf_v1',
  amount_cents integer NOT NULL DEFAULT 9900,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  provider text,
  provider_order_id text,
  paid_at timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  grant_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one active (pending or paid) order per user+chart+product.
CREATE UNIQUE INDEX premium_report_orders_active_unique
  ON public.premium_report_orders (user_id, chart_id, product_version)
  WHERE status IN ('pending','paid');

CREATE INDEX premium_report_orders_user_idx
  ON public.premium_report_orders (user_id, created_at DESC);

GRANT SELECT ON public.premium_report_orders TO authenticated;
GRANT ALL ON public.premium_report_orders TO service_role;

ALTER TABLE public.premium_report_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own premium orders"
  ON public.premium_report_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all premium orders"
  ON public.premium_report_orders
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER premium_report_orders_updated_at
  BEFORE UPDATE ON public.premium_report_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();


-- Premium PDF report: the generated deep-report content + storage pointer.
CREATE TABLE public.premium_pdf_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_id uuid NOT NULL REFERENCES public.charts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.premium_report_orders(id) ON DELETE SET NULL,
  source_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  report_version text NOT NULL DEFAULT 'premium_pdf_v1',
  prompt_version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','generating','completed','failed')),
  content_json jsonb,
  pdf_storage_path text,
  model text,
  provider text,
  generated_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX premium_pdf_reports_unique
  ON public.premium_pdf_reports (user_id, chart_id, report_version);

CREATE INDEX premium_pdf_reports_user_idx
  ON public.premium_pdf_reports (user_id, created_at DESC);

GRANT SELECT ON public.premium_pdf_reports TO authenticated;
GRANT ALL ON public.premium_pdf_reports TO service_role;

ALTER TABLE public.premium_pdf_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own premium pdf"
  ON public.premium_pdf_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all premium pdf"
  ON public.premium_pdf_reports
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER premium_pdf_reports_updated_at
  BEFORE UPDATE ON public.premium_pdf_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();


-- Admin audit trail for manual grants / status changes.
CREATE TABLE public.premium_grant_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.premium_report_orders(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  chart_id uuid NOT NULL REFERENCES public.charts(id),
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.premium_grant_audit TO authenticated;
GRANT ALL ON public.premium_grant_audit TO service_role;

ALTER TABLE public.premium_grant_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read grant audit"
  ON public.premium_grant_audit
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
