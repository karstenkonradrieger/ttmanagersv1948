-- Allow the club creator to act as administrator on club_players (insert players, update/delete, read all)
DROP POLICY IF EXISTS "Authorities, creators or self can read club_players" ON public.club_players;
CREATE POLICY "Authorities, creators or self can read club_players"
ON public.club_players
FOR SELECT
USING (
  (auth.uid() = created_by)
  OR public.is_club_authority(club_id)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_players.club_id AND c.created_by = auth.uid())
  OR ((public.current_user_email() <> '') AND (lower(email) = public.current_user_email()))
);

DROP POLICY IF EXISTS "Authenticated users can insert club_players" ON public.club_players;
CREATE POLICY "Authenticated users can insert club_players"
ON public.club_players
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.is_club_authority(club_id)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_players.club_id AND c.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Creators or authorities can update club_players" ON public.club_players;
CREATE POLICY "Creators or authorities can update club_players"
ON public.club_players
FOR UPDATE
USING (
  (auth.uid() = created_by)
  OR public.is_club_authority(club_id)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_players.club_id AND c.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Creators or authorities can delete club_players" ON public.club_players;
CREATE POLICY "Creators or authorities can delete club_players"
ON public.club_players
FOR DELETE
USING (
  (auth.uid() = created_by)
  OR public.is_club_authority(club_id)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_players.club_id AND c.created_by = auth.uid())
);

-- Auto-add the creator of a new club as an admin entry in club_players (best-effort)
CREATE OR REPLACE FUNCTION public.add_creator_as_club_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_email text;
  creator_name text;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(coalesce(u.email, '')),
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), 'Administrator')
  INTO creator_email, creator_name
  FROM auth.users u
  WHERE u.id = NEW.created_by;

  IF creator_email IS NULL OR creator_email = '' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicates if a row already exists for this email/club
  IF EXISTS (
    SELECT 1 FROM public.club_players
    WHERE club_id = NEW.id AND lower(email) = creator_email
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.club_players (club_id, name, email, role, created_by)
  VALUES (NEW.id, creator_name, creator_email, 'admin', NEW.created_by);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_creator_as_club_admin ON public.clubs;
CREATE TRIGGER trg_add_creator_as_club_admin
AFTER INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_club_admin();