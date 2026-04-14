-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can upload match photos" ON storage.objects;

-- Recreate with public role and auth.uid() check (more reliable)
CREATE POLICY "Authenticated users can upload match photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'match-photos' AND auth.uid() IS NOT NULL);