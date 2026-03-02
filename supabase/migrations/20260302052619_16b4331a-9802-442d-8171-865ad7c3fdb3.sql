
-- Add team references to matches for team tournaments
ALTER TABLE public.matches 
  ADD COLUMN home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX idx_matches_home_team ON public.matches(home_team_id) WHERE home_team_id IS NOT NULL;
CREATE INDEX idx_matches_away_team ON public.matches(away_team_id) WHERE away_team_id IS NOT NULL;
