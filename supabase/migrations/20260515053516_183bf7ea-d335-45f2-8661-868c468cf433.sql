ALTER TABLE public.club_players ADD COLUMN IF NOT EXISTS is_player boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.club_players_public;
CREATE VIEW public.club_players_public AS
SELECT id, club_id, name, gender, birth_date, ttr, photo_consent, voice_name_url, photo_consent_url, role, is_player, created_at
FROM public.club_players;