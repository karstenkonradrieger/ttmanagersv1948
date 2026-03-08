
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'Tischtennis',
  ADD COLUMN IF NOT EXISTS tournament_end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS directions_pdf_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_maps_link text DEFAULT NULL;
