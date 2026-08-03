DROP POLICY IF EXISTS community_letters_select_recipient ON public.community_letters;
CREATE POLICY community_letters_select_recipient ON public.community_letters
  FOR SELECT TO authenticated
  USING (
    status IN ('approved','redacted')
    AND EXISTS (
      SELECT 1 FROM public.community_letter_deliveries d
       WHERE d.letter_id = community_letters.id
         AND d.recipient_id = auth.uid()
         AND d.status <> 'hidden'
    )
  );