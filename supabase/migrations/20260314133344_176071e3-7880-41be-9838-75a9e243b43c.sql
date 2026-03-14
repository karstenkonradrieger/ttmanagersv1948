ALTER TABLE public.tournaments ADD COLUMN certificate_font_family text NOT NULL DEFAULT 'Helvetica';
ALTER TABLE public.tournaments ADD COLUMN certificate_font_size integer NOT NULL DEFAULT 20;