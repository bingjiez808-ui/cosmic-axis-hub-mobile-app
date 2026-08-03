CREATE OR REPLACE FUNCTION private.is_letter_recipient(_letter_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_letter_deliveries d
                  WHERE d.letter_id = _letter_id AND d.recipient_id = _uid);
$$;

CREATE OR REPLACE FUNCTION private.is_letter_author(_letter_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_letters l
                  WHERE l.id = _letter_id AND l.author_id = _uid);
$$;

DROP POLICY IF EXISTS community_letters_select_recipient ON public.community_letters;
CREATE POLICY community_letters_select_recipient ON public.community_letters
  FOR SELECT TO authenticated
  USING (private.is_letter_recipient(id, auth.uid()));

DROP POLICY IF EXISTS community_deliveries_select_own ON public.community_letter_deliveries;
CREATE POLICY community_deliveries_select_own ON public.community_letter_deliveries
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.is_letter_author(letter_id, auth.uid())
  );

DROP POLICY IF EXISTS community_replies_select_letter_author ON public.community_letter_replies;
CREATE POLICY community_replies_select_letter_author ON public.community_letter_replies
  FOR SELECT TO authenticated
  USING (status = 'approved' AND private.is_letter_author(letter_id, auth.uid()));