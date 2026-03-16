
CREATE TABLE public.schedule_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- FALTA, ATESTADO, COMPENSACAO, TROCA_FOLGA
  event_date DATE NOT NULL,
  event_date_end DATE, -- for ATESTADO range
  observation TEXT DEFAULT '',
  -- for TROCA_FOLGA
  related_collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  related_collaborator_name TEXT,
  original_day TEXT, -- original day off for swap
  swapped_day TEXT, -- new day off for swap
  week_start DATE, -- which week this swap applies to
  -- for COMPENSACAO
  holiday_compensation_id UUID REFERENCES public.holiday_compensations(id) ON DELETE SET NULL,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedule_events" ON public.schedule_events FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert schedule_events" ON public.schedule_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update schedule_events" ON public.schedule_events FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete schedule_events" ON public.schedule_events FOR DELETE TO public USING (true);

CREATE INDEX idx_schedule_events_date ON public.schedule_events(event_date);
CREATE INDEX idx_schedule_events_collab ON public.schedule_events(collaborator_id);
