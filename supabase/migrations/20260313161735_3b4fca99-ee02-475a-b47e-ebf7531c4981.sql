
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public read signatures" ON storage.objects FOR SELECT TO public USING (bucket_id = 'signatures');
CREATE POLICY "Authenticated upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "Authenticated delete signatures" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'signatures');
