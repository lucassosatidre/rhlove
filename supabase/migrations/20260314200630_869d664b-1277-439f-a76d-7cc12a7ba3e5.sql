
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view holidays" ON public.holidays FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert holidays" ON public.holidays FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update holidays" ON public.holidays FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete holidays" ON public.holidays FOR DELETE TO public USING (true);

CREATE TABLE public.holiday_compensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name text NOT NULL,
  sector text NOT NULL,
  holiday_date date NOT NULL,
  holiday_name text NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'SIM',
  compensation_date date DEFAULT NULL,
  observacao text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, holiday_date)
);

ALTER TABLE public.holiday_compensations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view holiday_compensations" ON public.holiday_compensations FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert holiday_compensations" ON public.holiday_compensations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update holiday_compensations" ON public.holiday_compensations FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete holiday_compensations" ON public.holiday_compensations FOR DELETE TO public USING (true);

CREATE TRIGGER update_holiday_compensations_updated_at
  BEFORE UPDATE ON public.holiday_compensations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 2026 holidays
INSERT INTO public.holidays (date, name) VALUES
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-03-23', 'Aniversário de Florianópolis'),
  ('2026-04-03', 'Sexta-Feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalhador'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Dia da Consciência Negra'),
  ('2026-12-25', 'Natal')
ON CONFLICT (date) DO NOTHING;
