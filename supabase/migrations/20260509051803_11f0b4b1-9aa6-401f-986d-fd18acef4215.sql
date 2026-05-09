ALTER TABLE public.playlist_tracks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_tracks;