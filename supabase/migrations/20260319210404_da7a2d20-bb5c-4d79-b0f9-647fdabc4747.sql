
CREATE TABLE public.punch_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name TEXT NOT NULL,
  date DATE NOT NULL,
  entrada TEXT,
  saida TEXT,
  saida_intervalo TEXT,
  retorno_intervalo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id, date)
);

ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view punch_records" ON public.punch_records FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert punch_records" ON public.punch_records FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update punch_records" ON public.punch_records FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete punch_records" ON public.punch_records FOR DELETE TO public USING (true);
