-- Add new columns to collaborators table
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS inicio_na_empresa date DEFAULT '2026-02-23',
  ADD COLUMN IF NOT EXISTS data_desligamento date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inicio_periodo date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fim_periodo date DEFAULT NULL;

-- Set inicio_na_empresa for all existing collaborators
UPDATE public.collaborators SET inicio_na_empresa = '2026-02-23' WHERE inicio_na_empresa IS NULL;

-- Migrate existing period data: data_retorno -> fim_periodo for FERIAS/AFASTADO
UPDATE public.collaborators SET fim_periodo = data_retorno WHERE status IN ('FERIAS', 'AFASTADO') AND data_retorno IS NOT NULL AND fim_periodo IS NULL;

-- Migrate data_fim_experiencia -> fim_periodo for EXPERIENCIA
UPDATE public.collaborators SET fim_periodo = data_fim_experiencia WHERE status = 'EXPERIENCIA' AND data_fim_experiencia IS NOT NULL AND fim_periodo IS NULL;

-- Migrate data_fim_aviso -> fim_periodo for AVISO_PREVIO
UPDATE public.collaborators SET fim_periodo = data_fim_aviso WHERE status = 'AVISO_PREVIO' AND data_fim_aviso IS NOT NULL AND fim_periodo IS NULL;