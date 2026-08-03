ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_intent text,
  ADD COLUMN IF NOT EXISTS onboarding_intent_at timestamptz;

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_onboarding_intent_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_onboarding_intent_check
  CHECK (onboarding_intent IS NULL OR onboarding_intent IN ('direction','courage','calm','connection'));