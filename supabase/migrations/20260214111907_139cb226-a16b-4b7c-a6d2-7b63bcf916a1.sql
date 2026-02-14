
-- Add created_by column to tournaments
ALTER TABLE public.tournaments ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop old permissive write policies on tournaments
DROP POLICY IF EXISTS "Anyone can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can delete tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;

-- Tournaments: public read, authenticated write (creator only for update/delete)
CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their tournaments" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Drop old permissive write policies on players
DROP POLICY IF EXISTS "Anyone can create players" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;
DROP POLICY IF EXISTS "Anyone can delete players" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;

-- Players: public read, write restricted to tournament creator
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Tournament creator can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Tournament creator can update players" ON public.players FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Tournament creator can delete players" ON public.players FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);

-- Drop old permissive write policies on matches
DROP POLICY IF EXISTS "Anyone can create matches" ON public.matches;
DROP POLICY IF EXISTS "Anyone can update matches" ON public.matches;
DROP POLICY IF EXISTS "Anyone can delete matches" ON public.matches;
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;

-- Matches: public read, write restricted to tournament creator
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Tournament creator can insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Tournament creator can update matches" ON public.matches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Tournament creator can delete matches" ON public.matches FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
