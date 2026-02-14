
-- Add gender and birth_date columns to players table
ALTER TABLE public.players ADD COLUMN gender text NOT NULL DEFAULT '';
ALTER TABLE public.players ADD COLUMN birth_date date;
