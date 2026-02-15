
-- Add new tournament fields: tournament_date, venue, motto
ALTER TABLE public.tournaments
  ADD COLUMN tournament_date date DEFAULT NULL,
  ADD COLUMN venue_street text NOT NULL DEFAULT '',
  ADD COLUMN venue_house_number text NOT NULL DEFAULT '',
  ADD COLUMN venue_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN venue_city text NOT NULL DEFAULT '',
  ADD COLUMN motto text NOT NULL DEFAULT '';
