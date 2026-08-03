CREATE TABLE public.tarot_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
GRANT SELECT ON public.tarot_usage TO authenticated;
GRANT ALL ON public.tarot_usage TO service_role;
ALTER TABLE public.tarot_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarot_usage_select_own" ON public.tarot_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE: only the service-role server function may write.