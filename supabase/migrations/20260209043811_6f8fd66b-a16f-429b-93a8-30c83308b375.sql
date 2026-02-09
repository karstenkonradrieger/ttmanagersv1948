-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Tischtennis Turnier',
  table_count INTEGER NOT NULL DEFAULT 4,
  rounds INTEGER NOT NULL DEFAULT 0,
  started BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  club TEXT NOT NULL DEFAULT '',
  ttr INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  table_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (tournaments are public for spectators)
CREATE POLICY "Anyone can view tournaments"
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view players"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view matches"
  ON public.matches FOR SELECT
  USING (true);

-- Public write access (no auth required for tournament management)
CREATE POLICY "Anyone can create tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update tournaments"
  ON public.tournaments FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete tournaments"
  ON public.tournaments FOR DELETE
  USING (true);

CREATE POLICY "Anyone can create players"
  ON public.players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update players"
  ON public.players FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete players"
  ON public.players FOR DELETE
  USING (true);

CREATE POLICY "Anyone can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update matches"
  ON public.matches FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete matches"
  ON public.matches FOR DELETE
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add trigger for tournaments
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;