ALTER TABLE public.schedule_events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO',
ADD COLUMN IF NOT EXISTS reverted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reverted_by text DEFAULT ''::text,
ADD COLUMN IF NOT EXISTS reverted_reason text DEFAULT ''::text;

CREATE INDEX IF NOT EXISTS idx_schedule_events_week_status
ON public.schedule_events (week_start, status);

CREATE INDEX IF NOT EXISTS idx_schedule_events_event_date_status
ON public.schedule_events (event_date, status);

CREATE INDEX IF NOT EXISTS idx_schedule_events_type_status
ON public.schedule_events (event_type, status);