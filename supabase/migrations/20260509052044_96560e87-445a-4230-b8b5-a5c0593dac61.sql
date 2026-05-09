-- Drop existing rows (migrating to per-tournament model)
DELETE FROM public.playlist_tracks;

-- Add tournament_id reference
ALTER TABLE public.playlist_tracks
  ADD COLUMN tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE;

CREATE INDEX idx_playlist_tracks_tournament ON public.playlist_tracks(tournament_id);

-- Replace RLS policies: scope to tournament creator
DROP POLICY IF EXISTS "Anyone can read playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Creators can delete playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Creators can insert playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Creators can update playlist tracks" ON public.playlist_tracks;

CREATE POLICY "Public read playlist_tracks"
  ON public.playlist_tracks FOR SELECT
  USING (true);

CREATE POLICY "Tournament creator can insert playlist_tracks"
  ON public.playlist_tracks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = playlist_tracks.tournament_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Tournament creator can update playlist_tracks"
  ON public.playlist_tracks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = playlist_tracks.tournament_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Tournament creator can delete playlist_tracks"
  ON public.playlist_tracks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = playlist_tracks.tournament_id AND t.created_by = auth.uid()
  ));