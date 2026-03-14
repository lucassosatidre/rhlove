
-- Add new columns to collaborators table
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS tipo_escala text NOT NULL DEFAULT '6x1',
  ADD COLUMN IF NOT EXISTS folgas_semanais text[] NOT NULL DEFAULT ARRAY['segunda']::text[],
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS data_fim_experiencia date,
  ADD COLUMN IF NOT EXISTS data_fim_aviso date;

-- Migrate existing weekly_day_off data into folgas_semanais array
UPDATE public.collaborators
SET folgas_semanais = ARRAY[UPPER(weekly_day_off)]::text[]
WHERE folgas_semanais = ARRAY['segunda']::text[];

-- Update sector values to uppercase
UPDATE public.collaborators SET sector = UPPER(sector);
UPDATE public.collaborators SET sector = 'SALÃO' WHERE UPPER(sector) = 'SALAO' OR UPPER(sector) = 'SALÃO';
UPDATE public.collaborators SET sector = 'TELE - ENTREGA' WHERE UPPER(sector) IN ('TELE - ENTREGA', 'TELE-ENTREGA', 'TELE ENTREGA');
UPDATE public.collaborators SET sector = 'COZINHA' WHERE UPPER(sector) = 'COZINHA';
UPDATE public.collaborators SET sector = 'DIURNO' WHERE UPPER(sector) = 'DIURNO';
