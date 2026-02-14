
ALTER TABLE public.players
  ADD COLUMN postal_code text NOT NULL DEFAULT '',
  ADD COLUMN city text NOT NULL DEFAULT '',
  ADD COLUMN street text NOT NULL DEFAULT '',
  ADD COLUMN house_number text NOT NULL DEFAULT '',
  ADD COLUMN phone text NOT NULL DEFAULT '';
