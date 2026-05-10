CREATE OR REPLACE FUNCTION public.prevent_club_delete_if_in_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_count integer;
BEGIN
  SELECT count(*) INTO participant_count
  FROM public.players p
  WHERE lower(trim(p.club)) = lower(trim(OLD.name));

  IF participant_count > 0 THEN
    RAISE EXCEPTION 'Verein "%" kann nicht gelöscht werden: % Spieler haben bereits an Turnieren teilgenommen oder nehmen aktuell teil.', OLD.name, participant_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_club_delete_if_in_use ON public.clubs;
CREATE TRIGGER trg_prevent_club_delete_if_in_use
BEFORE DELETE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_club_delete_if_in_use();