
-- Create clubs table
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Everyone can read clubs
CREATE POLICY "Public read clubs" ON public.clubs FOR SELECT USING (true);

-- Authenticated users can create clubs
CREATE POLICY "Authenticated users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Creators can update their clubs
CREATE POLICY "Creators can update clubs" ON public.clubs FOR UPDATE USING (auth.uid() = created_by);

-- Creators can delete their clubs
CREATE POLICY "Creators can delete clubs" ON public.clubs FOR DELETE USING (auth.uid() = created_by);
