
INSERT INTO storage.buckets (id, name, public)
VALUES ('directions', 'directions', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read directions" ON storage.objects
  FOR SELECT USING (bucket_id = 'directions');

CREATE POLICY "Authenticated users can upload directions" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'directions' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete directions" ON storage.objects
  FOR DELETE USING (bucket_id = 'directions' AND auth.role() = 'authenticated');
