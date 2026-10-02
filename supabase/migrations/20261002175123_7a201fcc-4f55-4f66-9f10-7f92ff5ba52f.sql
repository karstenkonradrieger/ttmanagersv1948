CREATE TABLE public.tournament_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.tournament_chat_messages TO authenticated;
GRANT ALL ON public.tournament_chat_messages TO service_role;

ALTER TABLE public.tournament_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament creators can read chat messages"
ON public.tournament_chat_messages
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Tournament creators can create chat messages"
ON public.tournament_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Tournament creators can delete chat messages"
ON public.tournament_chat_messages
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_id AND t.created_by = auth.uid()
  )
);

CREATE INDEX tournament_chat_messages_tournament_created_idx
ON public.tournament_chat_messages (tournament_id, created_at, id);

CREATE TRIGGER update_tournament_chat_messages_updated_at
BEFORE UPDATE ON public.tournament_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();