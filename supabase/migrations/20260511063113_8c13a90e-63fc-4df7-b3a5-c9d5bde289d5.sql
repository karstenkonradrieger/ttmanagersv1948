CREATE TABLE public.club_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  is_active boolean NOT NULL,
  changed_by uuid,
  changed_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_status_history_club ON public.club_status_history(club_id, created_at DESC);

ALTER TABLE public.club_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read club_status_history"
ON public.club_status_history FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert club_status_history"
ON public.club_status_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = changed_by);
