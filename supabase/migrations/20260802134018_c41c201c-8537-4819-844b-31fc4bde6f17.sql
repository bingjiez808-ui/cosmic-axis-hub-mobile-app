CREATE TABLE IF NOT EXISTS public.friend_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id),
  CHECK (length(body) <= 300)
);

CREATE INDEX IF NOT EXISTS friend_notes_recipient_idx ON public.friend_notes (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_notes_sender_idx ON public.friend_notes (sender_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.friend_notes TO authenticated;
GRANT ALL ON public.friend_notes TO service_role;
ALTER TABLE public.friend_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_notes_participant_select" ON public.friend_notes
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "friend_notes_sender_insert" ON public.friend_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "friend_notes_recipient_update" ON public.friend_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

ALTER TABLE public.community_notifications
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;