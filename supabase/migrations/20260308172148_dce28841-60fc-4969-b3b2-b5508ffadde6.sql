
-- Fix encounter_games foreign keys to CASCADE on delete
ALTER TABLE public.encounter_games DROP CONSTRAINT IF EXISTS encounter_games_match_id_fkey;
ALTER TABLE public.encounter_games ADD CONSTRAINT encounter_games_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

ALTER TABLE public.encounter_games DROP CONSTRAINT IF EXISTS encounter_games_home_player1_id_fkey;
ALTER TABLE public.encounter_games ADD CONSTRAINT encounter_games_home_player1_id_fkey FOREIGN KEY (home_player1_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.encounter_games DROP CONSTRAINT IF EXISTS encounter_games_home_player2_id_fkey;
ALTER TABLE public.encounter_games ADD CONSTRAINT encounter_games_home_player2_id_fkey FOREIGN KEY (home_player2_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.encounter_games DROP CONSTRAINT IF EXISTS encounter_games_away_player1_id_fkey;
ALTER TABLE public.encounter_games ADD CONSTRAINT encounter_games_away_player1_id_fkey FOREIGN KEY (away_player1_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.encounter_games DROP CONSTRAINT IF EXISTS encounter_games_away_player2_id_fkey;
ALTER TABLE public.encounter_games ADD CONSTRAINT encounter_games_away_player2_id_fkey FOREIGN KEY (away_player2_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- Also fix other tables referencing tournaments to CASCADE
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_tournament_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_tournament_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_tournament_id_fkey;
ALTER TABLE public.teams ADD CONSTRAINT teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

ALTER TABLE public.doubles_pairs DROP CONSTRAINT IF EXISTS doubles_pairs_tournament_id_fkey;
ALTER TABLE public.doubles_pairs ADD CONSTRAINT doubles_pairs_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

ALTER TABLE public.match_photos DROP CONSTRAINT IF EXISTS match_photos_tournament_id_fkey;
ALTER TABLE public.match_photos ADD CONSTRAINT match_photos_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Fix other cascading references
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE SET NULL;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE SET NULL;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_winner_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id) ON DELETE SET NULL;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_home_team_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_away_team_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.match_photos DROP CONSTRAINT IF EXISTS match_photos_match_id_fkey;
ALTER TABLE public.match_photos ADD CONSTRAINT match_photos_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

ALTER TABLE public.team_players DROP CONSTRAINT IF EXISTS team_players_team_id_fkey;
ALTER TABLE public.team_players ADD CONSTRAINT team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.team_players DROP CONSTRAINT IF EXISTS team_players_player_id_fkey;
ALTER TABLE public.team_players ADD CONSTRAINT team_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.doubles_pairs DROP CONSTRAINT IF EXISTS doubles_pairs_player1_id_fkey;
ALTER TABLE public.doubles_pairs ADD CONSTRAINT doubles_pairs_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.doubles_pairs DROP CONSTRAINT IF EXISTS doubles_pairs_player2_id_fkey;
ALTER TABLE public.doubles_pairs ADD CONSTRAINT doubles_pairs_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;
