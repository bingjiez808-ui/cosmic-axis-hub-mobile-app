CREATE OR REPLACE FUNCTION public.community_deliveries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Direct client writes (role authenticated/anon) may only mark a letter read.
  -- Server-side flows run as the RPC owner and are unaffected.
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.letter_id := OLD.letter_id;
    NEW.recipient_id := OLD.recipient_id;
    NEW.delivered_at := OLD.delivered_at;
    NEW.replied_at := OLD.replied_at;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'read' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;