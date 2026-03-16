
CREATE TABLE public.hr_event_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  override_date date,
  original_date date,
  concluded_at timestamptz,
  concluded_by text DEFAULT '',
  conclusion_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_event_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hr_event_completions" ON public.hr_event_completions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert hr_event_completions" ON public.hr_event_completions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update hr_event_completions" ON public.hr_event_completions FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete hr_event_completions" ON public.hr_event_completions FOR DELETE TO public USING (true);

CREATE TRIGGER update_hr_event_completions_updated_at
  BEFORE UPDATE ON public.hr_event_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
