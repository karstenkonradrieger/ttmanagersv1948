
CREATE TABLE public.announcement_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_key text NOT NULL UNIQUE,
  label text NOT NULL,
  audio_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcement_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read announcement_phrases" ON public.announcement_phrases FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert announcement_phrases" ON public.announcement_phrases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update announcement_phrases" ON public.announcement_phrases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete announcement_phrases" ON public.announcement_phrases FOR DELETE TO authenticated USING (true);

-- Seed the default phrase keys
INSERT INTO public.announcement_phrases (phrase_key, label) VALUES
  ('naechstes_spiel_tisch', 'Nächstes Spiel am Tisch'),
  ('naechstes_spiel', 'Nächstes Spiel'),
  ('es_spielt', 'Es spielt'),
  ('gegen', 'gegen'),
  ('vorbereitung', 'Es bereiten sich vor'),
  ('tisch_1', 'eins'),
  ('tisch_2', 'zwei'),
  ('tisch_3', 'drei'),
  ('tisch_4', 'vier'),
  ('tisch_5', 'fünf'),
  ('tisch_6', 'sechs'),
  ('tisch_7', 'sieben'),
  ('tisch_8', 'acht'),
  ('tisch_9', 'neun'),
  ('tisch_10', 'zehn'),
  ('tisch_11', 'elf'),
  ('tisch_12', 'zwölf');
