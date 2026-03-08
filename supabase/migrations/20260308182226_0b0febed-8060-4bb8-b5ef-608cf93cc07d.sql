-- Fix: Change restrictive policies to permissive for announcement_phrases
DROP POLICY IF EXISTS "Public read announcement_phrases" ON public.announcement_phrases;
CREATE POLICY "Public read announcement_phrases" ON public.announcement_phrases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert announcement_phrases" ON public.announcement_phrases;
CREATE POLICY "Authenticated users can insert announcement_phrases" ON public.announcement_phrases FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update announcement_phrases" ON public.announcement_phrases;
CREATE POLICY "Authenticated users can update announcement_phrases" ON public.announcement_phrases FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete announcement_phrases" ON public.announcement_phrases;
CREATE POLICY "Authenticated users can delete announcement_phrases" ON public.announcement_phrases FOR DELETE TO authenticated USING (true);