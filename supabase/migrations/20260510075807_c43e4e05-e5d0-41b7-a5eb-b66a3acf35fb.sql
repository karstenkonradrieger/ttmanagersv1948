ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_clubs_is_active ON public.clubs(is_active);