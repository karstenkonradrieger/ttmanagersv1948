
ALTER TABLE public.tournaments ADD COLUMN organizer_name text NOT NULL DEFAULT '';
ALTER TABLE public.tournaments ADD COLUMN sponsor_name text NOT NULL DEFAULT '';
ALTER TABLE public.tournaments ADD COLUMN sponsor_signature_url text DEFAULT NULL;
ALTER TABLE public.tournaments ADD COLUMN sponsor_consent boolean NOT NULL DEFAULT false;
