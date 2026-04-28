-- =====================================================
-- Crons automáticos da integração Saipos
-- =====================================================
-- 2 jobs:
--   - saipos_daily_yesterday: todo dia 06:00 BRT (09:00 UTC)
--     re-importa as vendas do dia anterior (mode=yesterday)
--   - saipos_weekly_verify: todo domingo 07:00 BRT (10:00 UTC)
--     re-baixa últimos 7 dias e atualiza daily_sales onde houver divergência
--
-- Os jobs chamam a edge function sync-saipos-sales via pg_net.
-- Como eles dependem da URL e do anon key específicos do projeto,
-- expomos RPCs schedule_saipos_jobs(...) e unschedule_saipos_jobs()
-- que o admin chama pelo botão "Agendar crons" no app.
-- =====================================================

CREATE OR REPLACE FUNCTION public.schedule_saipos_jobs(
  p_functions_url text,
  p_auth_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_url text := rtrim(p_functions_url, '/');
  v_jobs jsonb := '[]'::jsonb;
  v_job_id bigint;
BEGIN
  -- Remove versões anteriores (idempotente)
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN ('saipos_daily_yesterday', 'saipos_weekly_verify');

  -- Daily: 09:00 UTC = 06:00 BRT
  v_job_id := cron.schedule(
    'saipos_daily_yesterday',
    '0 9 * * *',
    format(
      $sql$ SELECT extensions.net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb,
        timeout_milliseconds := 120000
      ); $sql$,
      v_url || '/sync-saipos-sales',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_auth_key
      ),
      jsonb_build_object('mode', 'yesterday')
    )
  );
  v_jobs := v_jobs || jsonb_build_object(
    'name', 'saipos_daily_yesterday',
    'id', v_job_id,
    'schedule', '0 9 * * * (06h BRT)',
    'mode', 'yesterday'
  );

  -- Weekly: domingo 10:00 UTC = 07:00 BRT (re-verifica últimos 7d)
  v_job_id := cron.schedule(
    'saipos_weekly_verify',
    '0 10 * * 0',
    format(
      $sql$ SELECT extensions.net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb,
        timeout_milliseconds := 300000
      ); $sql$,
      v_url || '/sync-saipos-sales',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_auth_key
      ),
      jsonb_build_object('mode', 'weekly_verify', 'days_back', 7)
    )
  );
  v_jobs := v_jobs || jsonb_build_object(
    'name', 'saipos_weekly_verify',
    'id', v_job_id,
    'schedule', '0 10 * * 0 (Dom 07h BRT)',
    'mode', 'weekly_verify (7 dias)'
  );

  RETURN jsonb_build_object('success', true, 'jobs', v_jobs);
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_saipos_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_removed text[] := ARRAY[]::text[];
  v_jobname text;
BEGIN
  FOR v_jobname IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('saipos_daily_yesterday', 'saipos_weekly_verify')
  LOOP
    PERFORM cron.unschedule(v_jobname);
    v_removed := array_append(v_removed, v_jobname);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'removed', v_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_saipos_jobs()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  jobid bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT j.jobname, j.schedule, j.active, j.jobid
  FROM cron.job j
  WHERE j.jobname IN ('saipos_daily_yesterday', 'saipos_weekly_verify')
  ORDER BY j.jobname;
$$;

-- Permite admins chamarem via PostgREST (RLS controlado dentro)
GRANT EXECUTE ON FUNCTION public.schedule_saipos_jobs(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_saipos_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_saipos_jobs() TO authenticated;
