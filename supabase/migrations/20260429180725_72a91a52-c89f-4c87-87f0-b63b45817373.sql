-- 1. Tabela de histórico
CREATE TABLE public.collaborator_folgas_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  folgas_semanais text[] NOT NULL,
  sunday_n integer NOT NULL DEFAULT 0,
  vigente_desde date NOT NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT folgas_history_unique_date UNIQUE (collaborator_id, vigente_desde)
);

-- 2. Índice de lookup
CREATE INDEX idx_folgas_hist_lookup
  ON public.collaborator_folgas_history (collaborator_id, vigente_desde DESC);

-- 3. Função get_folgas_at
CREATE OR REPLACE FUNCTION public.get_folgas_at(
  p_collaborator_id uuid,
  p_date date
)
RETURNS TABLE (folgas_semanais text[], sunday_n integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT folgas_semanais, sunday_n
  FROM public.collaborator_folgas_history
  WHERE collaborator_id = p_collaborator_id
    AND vigente_desde <= p_date
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;

-- 4. RLS
ALTER TABLE public.collaborator_folgas_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can insert collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR UPDATE TO public USING (true);

CREATE POLICY "Anyone can delete collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR DELETE TO public USING (true);

-- 5. Backfill
INSERT INTO public.collaborator_folgas_history (
  collaborator_id, folgas_semanais, sunday_n, vigente_desde, motivo
)
SELECT
  id,
  folgas_semanais,
  COALESCE(sunday_n, 0),
  COALESCE(inicio_na_empresa, '2020-01-01'::date),
  'Backfill inicial'
FROM public.collaborators
ON CONFLICT (collaborator_id, vigente_desde) DO NOTHING;