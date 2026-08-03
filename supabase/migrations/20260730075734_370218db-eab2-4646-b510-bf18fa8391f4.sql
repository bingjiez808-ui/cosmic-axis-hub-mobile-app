CREATE OR REPLACE FUNCTION public.community_deliveries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, private AS $$
BEGIN
  -- SECURITY INVOKER: current_user is 'authenticated' for direct client writes,
  -- and the function owner when reached through a SECURITY DEFINER RPC.
  IF current_user IN ('authenticated', 'anon')
     AND auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
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