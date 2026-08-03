
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS concern text,
  ADD COLUMN IF NOT EXISTS concern_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_concern_check'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_concern_check
      CHECK (concern IS NULL OR concern IN (
        'study','career','love','relationships','finance','self_family','overview'
      ));
  END IF;
END $$;
