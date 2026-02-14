
-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow anyone to upload logos
CREATE POLICY "Anyone can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos');

-- Allow anyone to view logos
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Allow anyone to update logos
CREATE POLICY "Anyone can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos');

-- Allow anyone to delete logos
CREATE POLICY "Anyone can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos');

-- Add logo_url to tournaments
ALTER TABLE public.tournaments ADD COLUMN logo_url text DEFAULT null;
