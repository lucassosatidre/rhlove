
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS horario_entrada text;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS horario_saida text;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS jornadas_especiais jsonb;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS aviso_previo_reducao integer;
