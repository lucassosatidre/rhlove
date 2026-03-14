
CREATE TABLE public.scheduled_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name text NOT NULL,
  sector text NOT NULL,
  data_inicio_ferias date NOT NULL,
  data_fim_ferias date NOT NULL,
  status text NOT NULL DEFAULT 'PROGRAMADA',
  observacao text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled_vacations" ON public.scheduled_vacations FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert scheduled_vacations" ON public.scheduled_vacations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update scheduled_vacations" ON public.scheduled_vacations FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete scheduled_vacations" ON public.scheduled_vacations FOR DELETE TO public USING (true);

CREATE TRIGGER update_scheduled_vacations_updated_at
  BEFORE UPDATE ON public.scheduled_vacations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
