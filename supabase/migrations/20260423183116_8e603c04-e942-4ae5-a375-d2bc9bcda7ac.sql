-- Habilitar pg_cron se necessário
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função: retorna automaticamente colaboradores de FERIAS para ATIVO
-- quando não há período de férias ativo hoje
CREATE OR REPLACE FUNCTION public.auto_finalize_vacation_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.collaborators c
  SET status = 'ATIVO',
      updated_at = now()
  WHERE c.status = 'FERIAS'
    AND NOT EXISTS (
      SELECT 1
      FROM public.scheduled_vacations sv
      WHERE sv.collaborator_id = c.id
        AND sv.status <> 'CANCELADA'
        AND CURRENT_DATE BETWEEN sv.data_inicio_ferias AND sv.data_fim_ferias
    );
END;
$$;

-- Remover job anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-finalize-vacations');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Agendar diariamente às 08:00 UTC (= 05:00 BRT)
SELECT cron.schedule(
  'auto-finalize-vacations',
  '0 8 * * *',
  $$SELECT public.auto_finalize_vacation_status()$$
);

-- Executar imediatamente para corrigir backlog
SELECT public.auto_finalize_vacation_status();