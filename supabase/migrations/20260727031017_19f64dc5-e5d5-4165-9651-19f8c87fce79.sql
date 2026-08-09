-- Extend public.user_preferences with the two new deterministic state slices
-- introduced by the "primary_concern / daily_focus / support_mode" split.
-- primary_concern is already served by the existing `concern` column.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS daily_focus TEXT,
  ADD COLUMN IF NOT EXISTS daily_focus_date DATE,
  ADD COLUMN IF NOT EXISTS support_mode TEXT;

-- Enumerate allowed values via CHECK constraints (no time-dependent logic,
-- so CHECK is safe here per project guidance).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_daily_focus_check'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_daily_focus_check
      CHECK (daily_focus IS NULL OR daily_focus IN (
        'decision', 'relationship', 'work_study', 'money', 'body_mind', 'none'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_support_mode_check'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_support_mode_check
      CHECK (support_mode IS NULL OR support_mode IN (
        'clarify', 'decide', 'calm', 'understand'
      ));
  END IF;
END $$;