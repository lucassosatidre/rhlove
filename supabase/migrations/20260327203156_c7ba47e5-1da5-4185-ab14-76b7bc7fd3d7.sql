
CREATE TABLE public.sunday_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  consecutive_sundays_from_previous integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, month, year)
);

ALTER TABLE public.sunday_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sunday_tracking" ON public.sunday_tracking FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert sunday_tracking" ON public.sunday_tracking FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update sunday_tracking" ON public.sunday_tracking FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete sunday_tracking" ON public.sunday_tracking FOR DELETE TO public USING (true);
