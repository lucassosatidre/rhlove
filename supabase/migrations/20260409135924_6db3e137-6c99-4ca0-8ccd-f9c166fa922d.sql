
-- Create saipos_sync_log table
CREATE TABLE public.saipos_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_date date NOT NULL,
  mode text NOT NULL DEFAULT 'yesterday',
  total_sales integer NOT NULL DEFAULT 0,
  faturamento_total numeric NOT NULL DEFAULT 0,
  pedidos_totais integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saipos_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view saipos_sync_log"
  ON public.saipos_sync_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can insert saipos_sync_log"
  ON public.saipos_sync_log FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update saipos_sync_log"
  ON public.saipos_sync_log FOR UPDATE
  TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete saipos_sync_log"
  ON public.saipos_sync_log FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- Service role needs access too (edge function uses service_role)
CREATE POLICY "Service role full access saipos_sync_log"
  ON public.saipos_sync_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Add unique constraint on daily_sales.date
ALTER TABLE public.daily_sales ADD CONSTRAINT daily_sales_date_unique UNIQUE (date);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
