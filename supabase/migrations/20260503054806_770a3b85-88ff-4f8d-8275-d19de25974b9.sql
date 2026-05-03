ALTER TABLE public.tournament_sponsors REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_sponsors;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;