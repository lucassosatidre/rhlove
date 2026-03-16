CREATE TABLE public.afastamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name text NOT NULL,
  sector text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacao text DEFAULT '',
  created_by text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view afastamentos" ON public.afastamentos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert afastamentos" ON public.afastamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update afastamentos" ON public.afastamentos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete afastamentos" ON public.afastamentos FOR DELETE USING (true);

CREATE TRIGGER update_afastamentos_updated_at
  BEFORE UPDATE ON public.afastamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();