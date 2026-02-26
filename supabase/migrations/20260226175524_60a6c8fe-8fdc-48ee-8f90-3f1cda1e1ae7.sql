
ALTER TABLE public.club_players ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE public.club_players ADD COLUMN photo_consent boolean NOT NULL DEFAULT false;
