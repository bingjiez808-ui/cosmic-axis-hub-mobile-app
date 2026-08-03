ALTER TABLE public.charts
  ADD COLUMN IF NOT EXISTS relationship_label TEXT,
  ADD COLUMN IF NOT EXISTS consent_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.charts
  ADD CONSTRAINT charts_relationship_label_len
  CHECK (relationship_label IS NULL OR length(relationship_label) <= 80);

ALTER TABLE public.friend_invites
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.friend_invites
  ADD CONSTRAINT friend_invites_message_len
  CHECK (message IS NULL OR length(message) <= 500);