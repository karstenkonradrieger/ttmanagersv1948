
-- Create playlist_tracks table
CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_gong BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can read tracks (for playback on live views etc.)
CREATE POLICY "Anyone can read playlist tracks"
  ON public.playlist_tracks FOR SELECT
  USING (true);

-- Authenticated users can manage tracks
CREATE POLICY "Authenticated users can insert playlist tracks"
  ON public.playlist_tracks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update playlist tracks"
  ON public.playlist_tracks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete playlist tracks"
  ON public.playlist_tracks FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true);

-- Storage policies
CREATE POLICY "Anyone can read audio files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Authenticated users can delete audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio');
