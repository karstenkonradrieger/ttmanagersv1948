ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS bracket_type TEXT NOT NULL DEFAULT 'main';

CREATE INDEX IF NOT EXISTS idx_matches_tournament_bracket
  ON public.matches (tournament_id, bracket_type);