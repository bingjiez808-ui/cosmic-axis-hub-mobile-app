
-- Explicit deny of any direct client access to premium-pdfs objects.
-- Users must go through server-issued short-lived signed URLs.
CREATE POLICY "premium_pdfs_no_direct_access"
  ON storage.objects
  FOR ALL TO authenticated, anon
  USING (bucket_id <> 'premium-pdfs')
  WITH CHECK (bucket_id <> 'premium-pdfs');
