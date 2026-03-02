
-- Add team_mode and early_finish_enabled columns to tournaments
ALTER TABLE public.tournaments 
  ADD COLUMN team_mode text DEFAULT NULL,
  ADD COLUMN early_finish_enabled boolean NOT NULL DEFAULT false;

-- Create teams table
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Tournament creator can insert teams" ON public.teams FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = teams.tournament_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can update teams" ON public.teams FOR UPDATE
  USING (EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = teams.tournament_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can delete teams" ON public.teams FOR DELETE
  USING (EXISTS (SELECT 1 FROM tournaments WHERE tournaments.id = teams.tournament_id AND tournaments.created_by = auth.uid()));

-- Create team_players table (maps players to teams with position)
CREATE TABLE public.team_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, player_id)
);

ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read team_players" ON public.team_players FOR SELECT USING (true);
CREATE POLICY "Tournament creator can insert team_players" ON public.team_players FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM teams JOIN tournaments ON tournaments.id = teams.tournament_id WHERE teams.id = team_players.team_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can update team_players" ON public.team_players FOR UPDATE
  USING (EXISTS (SELECT 1 FROM teams JOIN tournaments ON tournaments.id = teams.tournament_id WHERE teams.id = team_players.team_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can delete team_players" ON public.team_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM teams JOIN tournaments ON tournaments.id = teams.tournament_id WHERE teams.id = team_players.team_id AND tournaments.created_by = auth.uid()));

-- Create encounter_games table (individual games within a team match/encounter)
CREATE TABLE public.encounter_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number integer NOT NULL,
  game_type text NOT NULL DEFAULT 'singles',
  home_player1_id uuid REFERENCES public.players(id),
  home_player2_id uuid REFERENCES public.players(id),
  away_player1_id uuid REFERENCES public.players(id),
  away_player2_id uuid REFERENCES public.players(id),
  sets jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_side text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.encounter_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read encounter_games" ON public.encounter_games FOR SELECT USING (true);
CREATE POLICY "Tournament creator can insert encounter_games" ON public.encounter_games FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM matches JOIN tournaments ON tournaments.id = matches.tournament_id WHERE matches.id = encounter_games.match_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can update encounter_games" ON public.encounter_games FOR UPDATE
  USING (EXISTS (SELECT 1 FROM matches JOIN tournaments ON tournaments.id = matches.tournament_id WHERE matches.id = encounter_games.match_id AND tournaments.created_by = auth.uid()));
CREATE POLICY "Tournament creator can delete encounter_games" ON public.encounter_games FOR DELETE
  USING (EXISTS (SELECT 1 FROM matches JOIN tournaments ON tournaments.id = matches.tournament_id WHERE matches.id = encounter_games.match_id AND tournaments.created_by = auth.uid()));

CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_team_players_team ON public.team_players(team_id);
CREATE INDEX idx_encounter_games_match ON public.encounter_games(match_id);
