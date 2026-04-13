
-- Create tournament_sponsors table
CREATE TABLE public.tournament_sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sort_order_range CHECK (sort_order >= 1 AND sort_order <= 5)
);

-- Enable RLS
ALTER TABLE public.tournament_sponsors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Public read tournament_sponsors"
ON public.tournament_sponsors FOR SELECT
USING (true);

CREATE POLICY "Tournament creator can insert tournament_sponsors"
ON public.tournament_sponsors FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM tournaments WHERE tournaments.id = tournament_sponsors.tournament_id AND tournaments.created_by = auth.uid()
));

CREATE POLICY "Tournament creator can update tournament_sponsors"
ON public.tournament_sponsors FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM tournaments WHERE tournaments.id = tournament_sponsors.tournament_id AND tournaments.created_by = auth.uid()
));

CREATE POLICY "Tournament creator can delete tournament_sponsors"
ON public.tournament_sponsors FOR DELETE
USING (EXISTS (
  SELECT 1 FROM tournaments WHERE tournaments.id = tournament_sponsors.tournament_id AND tournaments.created_by = auth.uid()
));

-- Migrate existing sponsor data
INSERT INTO public.tournament_sponsors (tournament_id, name, logo_url, sort_order)
SELECT id, sponsor_name, sponsor_logo_url, 1
FROM public.tournaments
WHERE sponsor_name IS NOT NULL AND sponsor_name != '';

-- Remove old sponsor columns
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS sponsor_name;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS sponsor_logo_url;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS sponsor_signature_url;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS sponsor_consent;
