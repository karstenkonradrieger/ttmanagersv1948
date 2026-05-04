-- Helper: aktuelle User-E-Mail
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), ''))
$$;

-- Prüft, ob der aktuelle User Admin oder Vorsitz eines Vereins ist (per E-Mail-Match)
CREATE OR REPLACE FUNCTION public.is_club_authority(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_players cp
    WHERE cp.club_id = _club_id
      AND cp.role IN ('admin', 'chairman')
      AND lower(cp.email) = public.current_user_email()
      AND public.current_user_email() <> ''
  )
$$;

-- Prüft, ob der aktuelle User irgendwo Authority ist (für Self-Visibility seines eigenen Eintrags)
CREATE OR REPLACE FUNCTION public.is_self_club_player(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_players cp
    WHERE cp.id = _player_id
      AND lower(cp.email) = public.current_user_email()
      AND public.current_user_email() <> ''
  )
$$;

-- ===== CLUBS RLS =====
DROP POLICY IF EXISTS "Creators can update clubs" ON public.clubs;
DROP POLICY IF EXISTS "Creators can delete clubs" ON public.clubs;

CREATE POLICY "Creators or authorities can update clubs"
ON public.clubs FOR UPDATE
USING (auth.uid() = created_by OR public.is_club_authority(id));

CREATE POLICY "Creators or authorities can delete clubs"
ON public.clubs FOR DELETE
USING (auth.uid() = created_by OR public.is_club_authority(id));

-- ===== CLUB_PLAYERS: sensible Felder nur für Authorities/Creator/Self =====
-- Public View ohne PII
CREATE OR REPLACE VIEW public.club_players_public
WITH (security_invoker = on) AS
SELECT
  id, club_id, name, gender, birth_date, ttr, photo_consent, voice_name_url,
  photo_consent_url, role, created_at
FROM public.club_players;

-- Basistabelle: SELECT nur für Creator, Authority des Clubs, oder Self (per E-Mail)
DROP POLICY IF EXISTS "Public read club_players" ON public.club_players;

CREATE POLICY "Authorities, creators or self can read club_players"
ON public.club_players FOR SELECT
USING (
  auth.uid() = created_by
  OR public.is_club_authority(club_id)
  OR (current_user_email() <> '' AND lower(email) = public.current_user_email())
);

-- UPDATE/DELETE auch für Authorities erlauben
DROP POLICY IF EXISTS "Creators can update club_players" ON public.club_players;
DROP POLICY IF EXISTS "Creators can delete club_players" ON public.club_players;

CREATE POLICY "Creators or authorities can update club_players"
ON public.club_players FOR UPDATE
USING (auth.uid() = created_by OR public.is_club_authority(club_id));

CREATE POLICY "Creators or authorities can delete club_players"
ON public.club_players FOR DELETE
USING (auth.uid() = created_by OR public.is_club_authority(club_id));

-- INSERT bleibt: created_by = auth.uid()  (Authorities können bestehende Daten verwalten;
-- neue Spieler anlegen darf jeder authentifizierte User – created_by wird er selbst)

-- View public-readable
GRANT SELECT ON public.club_players_public TO anon, authenticated;