
-- Create match_photos table
CREATE TABLE public.match_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL DEFAULT 'match' CHECK (photo_type IN ('match', 'ceremony')),
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_photos ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read match_photos" ON public.match_photos
  FOR SELECT USING (true);

-- Tournament creator can insert
CREATE POLICY "Tournament creator can insert match_photos" ON public.match_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = match_photos.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

-- Tournament creator can delete
CREATE POLICY "Tournament creator can delete match_photos" ON public.match_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = match_photos.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

-- Create storage bucket for match photos
INSERT INTO storage.buckets (id, name, public) VALUES ('match-photos', 'match-photos', true);

-- Storage policies
CREATE POLICY "Public read match photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'match-photos');

CREATE POLICY "Authenticated users can upload match photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'match-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete match photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'match-photos' AND auth.role() = 'authenticated');
