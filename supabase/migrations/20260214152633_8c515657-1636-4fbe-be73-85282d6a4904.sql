
-- Add mode and type columns to tournaments
ALTER TABLE public.tournaments 
ADD COLUMN mode text NOT NULL DEFAULT 'knockout',
ADD COLUMN type text NOT NULL DEFAULT 'singles';

-- Create doubles pairs table
CREATE TABLE public.doubles_pairs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  pair_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doubles_pairs ENABLE ROW LEVEL SECURITY;

-- RLS policies for doubles_pairs
CREATE POLICY "Public read doubles_pairs" ON public.doubles_pairs
FOR SELECT USING (true);

CREATE POLICY "Tournament creator can insert doubles_pairs" ON public.doubles_pairs
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = doubles_pairs.tournament_id AND tournaments.created_by = auth.uid())
);

CREATE POLICY "Tournament creator can update doubles_pairs" ON public.doubles_pairs
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = doubles_pairs.tournament_id AND tournaments.created_by = auth.uid())
);

CREATE POLICY "Tournament creator can delete doubles_pairs" ON public.doubles_pairs
FOR DELETE USING (
  EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = doubles_pairs.tournament_id AND tournaments.created_by = auth.uid())
);
