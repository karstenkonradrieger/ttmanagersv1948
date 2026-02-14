
-- Add best_of column to tournaments (number of sets needed to win: 2 or 3)
ALTER TABLE public.tournaments 
ADD COLUMN best_of integer NOT NULL DEFAULT 3;
