-- 1. Extend feedback_category enum (product / payment / subscription)
ALTER TYPE public.feedback_category ADD VALUE IF NOT EXISTS 'product';
ALTER TYPE public.feedback_category ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE public.feedback_category ADD VALUE IF NOT EXISTS 'subscription';

-- 2. Ticket status + priority enums
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('new','in_progress','waiting_user','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Human-readable ticket code sequence + generator
CREATE SEQUENCE IF NOT EXISTS public.feedback_ticket_seq START 1001;
GRANT USAGE ON SEQUENCE public.feedback_ticket_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.feedback_ticket_seq');
  RETURN 'FN-' || to_char(now(), 'YYMM') || '-' || lpad(n::text, 5, '0');
END; $$;

-- 4. Extend user_feedback with ticket fields
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS ticket_code text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.premium_report_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.ticket_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority public.ticket_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS user_reply text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Backfill ticket_code for existing rows and lock it in.
UPDATE public.user_feedback SET ticket_code = public.generate_ticket_code() WHERE ticket_code IS NULL;
ALTER TABLE public.user_feedback ALTER COLUMN ticket_code SET DEFAULT public.generate_ticket_code();
ALTER TABLE public.user_feedback ALTER COLUMN ticket_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_feedback_ticket_code_uniq ON public.user_feedback(ticket_code);

-- Idempotency (per-user request id)
CREATE UNIQUE INDEX IF NOT EXISTS user_feedback_request_uniq
  ON public.user_feedback (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_feedback_status_idx ON public.user_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_user_created_idx ON public.user_feedback(user_id, created_at DESC);

-- Trigger: updated_at + resolved_at bookkeeping
CREATE OR REPLACE FUNCTION public.user_feedback_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_feedback_touch_trg ON public.user_feedback;
CREATE TRIGGER user_feedback_touch_trg
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.user_feedback_touch();

-- 5. Column-level privileges: hide admin_note from ordinary authenticated users.
--    Admin server functions use service_role and bypass this.
REVOKE ALL ON public.user_feedback FROM authenticated;
GRANT SELECT
  (id, user_id, category, message, keywords, lang, resolved, created_at,
   ticket_code, subject, order_id, status, priority, user_reply, request_id,
   updated_at, resolved_at)
  ON public.user_feedback TO authenticated;
GRANT INSERT
  (user_id, category, message, keywords, lang, subject, order_id, request_id, priority)
  ON public.user_feedback TO authenticated;
GRANT UPDATE (user_reply) ON public.user_feedback TO authenticated;
GRANT ALL ON public.user_feedback TO service_role;

-- RLS policies were already in place (own SELECT/INSERT, admin SELECT/UPDATE). Keep them.
