
-- Create tournament_videos table to store generated video clips
CREATE TABLE public.tournament_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tournament_videos" ON public.tournament_videos
  FOR SELECT TO public USING (true);

CREATE POLICY "Tournament creator can insert tournament_videos" ON public.tournament_videos
  FOR INSERT TO public WITH CHECK (
    EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = tournament_videos.tournament_id AND tournaments.created_by = auth.uid())
  );

CREATE POLICY "Tournament creator can delete tournament_videos" ON public.tournament_videos
  FOR DELETE TO public USING (
    EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = tournament_videos.tournament_id AND tournaments.created_by = auth.uid())
  );

-- Create storage bucket for tournament videos
INSERT INTO storage.buckets (id, name, public) VALUES ('tournament-videos', 'tournament-videos', true);

-- Storage policies for tournament-videos bucket
CREATE POLICY "Public read tournament-videos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'tournament-videos');

CREATE POLICY "Authenticated users can upload tournament-videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tournament-videos');

CREATE POLICY "Authenticated users can delete tournament-videos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'tournament-videos');
