
CREATE POLICY "Authenticated users can upload tournament videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tournament-videos');

CREATE POLICY "Authenticated users can update tournament videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tournament-videos');

CREATE POLICY "Public can read tournament videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tournament-videos');

CREATE POLICY "Authenticated users can delete tournament videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tournament-videos');
