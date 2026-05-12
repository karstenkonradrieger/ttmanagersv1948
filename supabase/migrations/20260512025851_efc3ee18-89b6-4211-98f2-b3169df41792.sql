-- Verlauf für Rollenänderungen
CREATE TABLE public.club_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid,
  player_name text NOT NULL DEFAULT '',
  player_email text NOT NULL DEFAULT '',
  old_role text,
  new_role text,
  action text NOT NULL, -- 'insert' | 'update' | 'delete'
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_role_history_club_created ON public.club_role_history(club_id, created_at DESC);

ALTER TABLE public.club_role_history ENABLE ROW LEVEL SECURITY;

-- Nur Vereinsersteller, Authority oder Self dürfen den Verlauf einsehen
CREATE POLICY "Authority/creator/self read club_role_history"
ON public.club_role_history FOR SELECT
USING (
  public.is_club_authority(club_id)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_role_history.club_id AND c.created_by = auth.uid())
  OR (
    current_user_email() <> ''
    AND lower(player_email) = current_user_email()
  )
);

-- Insert nur via Trigger (SECURITY DEFINER), keine Client-Inserts
CREATE POLICY "No direct insert club_role_history"
ON public.club_role_history FOR INSERT
WITH CHECK (false);

-- Trigger-Funktion
CREATE OR REPLACE FUNCTION public.log_club_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_email text := current_user_email();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('admin', 'chairman') THEN
      INSERT INTO public.club_role_history(club_id, player_id, player_name, player_email, old_role, new_role, action, changed_by, changed_by_email)
      VALUES (NEW.club_id, NEW.id, NEW.name, NEW.email, NULL, NEW.role, 'insert', actor_id, actor_email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF coalesce(OLD.role,'') <> coalesce(NEW.role,'') AND (OLD.role IN ('admin','chairman') OR NEW.role IN ('admin','chairman')) THEN
      INSERT INTO public.club_role_history(club_id, player_id, player_name, player_email, old_role, new_role, action, changed_by, changed_by_email)
      VALUES (NEW.club_id, NEW.id, NEW.name, NEW.email, OLD.role, NEW.role, 'update', actor_id, actor_email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role IN ('admin','chairman') THEN
      INSERT INTO public.club_role_history(club_id, player_id, player_name, player_email, old_role, new_role, action, changed_by, changed_by_email)
      VALUES (OLD.club_id, OLD.id, OLD.name, OLD.email, OLD.role, NULL, 'delete', actor_id, actor_email);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_club_role_change ON public.club_players;
CREATE TRIGGER trg_log_club_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.club_players
FOR EACH ROW EXECUTE FUNCTION public.log_club_role_change();