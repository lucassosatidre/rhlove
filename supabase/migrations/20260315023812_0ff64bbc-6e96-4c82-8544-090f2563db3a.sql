
CREATE TABLE public.avisos_previos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_name text NOT NULL,
  sector text NOT NULL,
  opcao text NOT NULL DEFAULT '2h a menos por dia',
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  data_pagamento date,
  pago boolean NOT NULL DEFAULT false,
  exame boolean NOT NULL DEFAULT false,
  assinatura boolean NOT NULL DEFAULT false,
  enviado_contabilidade boolean NOT NULL DEFAULT false,
  data_envio_contabilidade date,
  observacoes text DEFAULT '',
  status_processo text NOT NULL DEFAULT 'Em andamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos_previos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view avisos_previos" ON public.avisos_previos FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert avisos_previos" ON public.avisos_previos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update avisos_previos" ON public.avisos_previos FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete avisos_previos" ON public.avisos_previos FOR DELETE TO public USING (true);

CREATE TRIGGER update_avisos_previos_updated_at
  BEFORE UPDATE ON public.avisos_previos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
