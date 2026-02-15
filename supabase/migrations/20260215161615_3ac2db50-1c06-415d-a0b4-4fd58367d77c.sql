
-- Master player list linked to clubs, independent of tournaments
CREATE TABLE public.club_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  ttr INTEGER NOT NULL DEFAULT 1000,
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  house_number TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.club_players ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read club_players"
  ON public.club_players FOR SELECT
  USING (true);

-- Creator can insert
CREATE POLICY "Authenticated users can insert club_players"
  ON public.club_players FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Creator can update
CREATE POLICY "Creators can update club_players"
  ON public.club_players FOR UPDATE
  USING (auth.uid() = created_by);

-- Creator can delete
CREATE POLICY "Creators can delete club_players"
  ON public.club_players FOR DELETE
  USING (auth.uid() = created_by);

-- Index for fast lookup by club
CREATE INDEX idx_club_players_club_id ON public.club_players(club_id);
