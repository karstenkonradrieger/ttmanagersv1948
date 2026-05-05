-- 1) Tighten "always true" write policies on announcement_phrases
DROP POLICY IF EXISTS "Authenticated users can delete announcement_phrases" ON public.announcement_phrases;
DROP POLICY IF EXISTS "Authenticated users can insert announcement_phrases" ON public.announcement_phrases;
DROP POLICY IF EXISTS "Authenticated users can update announcement_phrases" ON public.announcement_phrases;

CREATE POLICY "Creators can insert announcement_phrases"
  ON public.announcement_phrases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update announcement_phrases"
  ON public.announcement_phrases FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete announcement_phrases"
  ON public.announcement_phrases FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 2) Tighten "always true" write policies on playlist_tracks
DROP POLICY IF EXISTS "Authenticated users can delete playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Authenticated users can insert playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Authenticated users can update playlist tracks" ON public.playlist_tracks;

CREATE POLICY "Creators can insert playlist tracks"
  ON public.playlist_tracks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update playlist tracks"
  ON public.playlist_tracks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete playlist tracks"
  ON public.playlist_tracks FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 3) Restrict SECURITY DEFINER functions: revoke from anon, keep authenticated
REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_club_authority(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_self_club_player(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_authority(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_club_player(uuid) TO authenticated;
-- update_updated_at_column is a trigger function — no direct EXECUTE needed by clients