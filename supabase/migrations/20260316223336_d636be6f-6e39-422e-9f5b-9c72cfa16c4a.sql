
ALTER TABLE public.freelancer_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_by text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS observation text NULL DEFAULT '';
