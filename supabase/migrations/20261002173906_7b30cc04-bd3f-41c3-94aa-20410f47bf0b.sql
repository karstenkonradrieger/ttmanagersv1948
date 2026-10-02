CREATE TABLE public.tournament_summaries (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2400),
  source_signature TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_summaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournament_summaries TO authenticated;
GRANT ALL ON public.tournament_summaries TO service_role;

ALTER TABLE public.tournament_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament summaries are publicly readable"
ON public.tournament_summaries
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Tournament creators can create summaries"
ON public.tournament_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  generated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Tournament creators can update summaries"
ON public.tournament_summaries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
)
WITH CHECK (
  generated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Tournament creators can delete summaries"
ON public.tournament_summaries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.set_tournament_summary_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_tournament_summary_updated_at
BEFORE UPDATE ON public.tournament_summaries
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_summary_updated_at();