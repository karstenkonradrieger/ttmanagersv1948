
ALTER TABLE public.clubs
  ADD COLUMN street text NOT NULL DEFAULT '',
  ADD COLUMN house_number text NOT NULL DEFAULT '',
  ADD COLUMN postal_code text NOT NULL DEFAULT '',
  ADD COLUMN city text NOT NULL DEFAULT '',
  ADD COLUMN chairman text NOT NULL DEFAULT '',
  ADD COLUMN logo_url text DEFAULT NULL,
  ADD COLUMN phone text NOT NULL DEFAULT '',
  ADD COLUMN email text NOT NULL DEFAULT '',
  ADD COLUMN website text NOT NULL DEFAULT '';
