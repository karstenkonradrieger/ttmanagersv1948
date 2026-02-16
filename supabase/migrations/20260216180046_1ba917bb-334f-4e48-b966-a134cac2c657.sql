
-- Add group_number to players (nullable, only used in group_knockout mode)
ALTER TABLE public.players ADD COLUMN group_number integer DEFAULT NULL;

-- Add group_number to matches (nullable, identifies which group a match belongs to)
ALTER TABLE public.matches ADD COLUMN group_number integer DEFAULT NULL;

-- Add phase to tournaments ('group' or 'knockout', null for non-group_knockout modes)
ALTER TABLE public.tournaments ADD COLUMN phase text DEFAULT NULL;
