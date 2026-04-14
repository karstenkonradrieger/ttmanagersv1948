-- Drop the restrictive upload policy and recreate with simpler check
DROP POLICY IF EXISTS "Authenticated users can upload match photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload match photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'match-photos');

-- Also fix the delete policy
DROP POLICY IF EXISTS "Authenticated users can delete match photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete match photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'match-photos');