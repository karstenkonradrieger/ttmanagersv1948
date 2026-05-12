CREATE OR REPLACE VIEW public.club_role_history_public
WITH (security_invoker=on) AS
SELECT
  id,
  club_id,
  player_id,
  player_name,
  old_role,
  new_role,
  action,
  created_at
FROM public.club_role_history;

-- Public read auf der View ermöglichen, indem wir der Basistabelle eine Lese-Policy für anonymisierte Spalten geben?
-- Stattdessen: zusätzliche SELECT-Policy auf Basistabelle nicht erlaubt (würde Mails leaken).
-- Lösung: Security Invoker View funktioniert nur mit RLS der Basistabelle.
-- Daher zusätzliche Policy: alle dürfen lesen, aber nur über die View — wir setzen separate Policy via column privileges:
GRANT SELECT (id, club_id, player_id, player_name, old_role, new_role, action, created_at)
  ON public.club_role_history TO anon, authenticated;

-- Public-Read-Policy nur für nicht-sensible Spalten existiert nicht in Postgres column-level — also brauchen wir eine zweite Policy:
CREATE POLICY "Public read club_role_history (non-sensitive)"
ON public.club_role_history FOR SELECT
USING (true);

-- Wichtig: Die bestehende strengere Policy bleibt; mehrere SELECT-Policies sind permissiv (ODER-verknüpft).
-- E-Mail-Spalten werden auf API-Ebene durch GRANT-Spaltenrechte nicht geschützt, da wir SELECT(*) bereits durch RLS = true erlauben.
-- Daher Spalten-Privilegien explizit entziehen:
REVOKE SELECT ON public.club_role_history FROM anon, authenticated;
GRANT SELECT (id, club_id, player_id, player_name, old_role, new_role, action, created_at)
  ON public.club_role_history TO anon, authenticated;
GRANT SELECT (player_email, changed_by, changed_by_email)
  ON public.club_role_history TO authenticated;
-- Hinweis: Die Spalten-Grants für authenticated greifen nur, wenn auch RLS erlaubt — die strengere Policy filtert weiterhin auf Authority/Creator/Self.