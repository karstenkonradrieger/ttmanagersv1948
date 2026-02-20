
-- Add completed_at timestamp to matches table to track when a match was finished
ALTER TABLE public.matches ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;
