
CREATE TABLE public.hr_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  collaborator_name text DEFAULT '',
  sector text DEFAULT '',
  responsible text DEFAULT '',
  event_date date NOT NULL,
  event_time time DEFAULT NULL,
  reminder_type text NOT NULL DEFAULT 'outro',
  priority text NOT NULL DEFAULT 'media',
  recurrence text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'pendente',
  conclusion_note text DEFAULT '',
  created_by text DEFAULT '',
  concluded_by text DEFAULT '',
  concluded_at timestamp with time zone DEFAULT NULL,
  postponed_to date DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hr_reminders" ON public.hr_reminders FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert hr_reminders" ON public.hr_reminders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update hr_reminders" ON public.hr_reminders FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete hr_reminders" ON public.hr_reminders FOR DELETE TO public USING (true);
