
-- Add new columns to collaborators
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS funcao text;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS carga_horaria_mensal integer;

-- Create bonus_funcao_pontos table
CREATE TABLE public.bonus_funcao_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao text NOT NULL,
  carga_horaria integer NOT NULL,
  pontos numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcao, carga_horaria)
);

ALTER TABLE public.bonus_funcao_pontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor can select bonus_funcao_pontos" ON public.bonus_funcao_pontos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert bonus_funcao_pontos" ON public.bonus_funcao_pontos
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update bonus_funcao_pontos" ON public.bonus_funcao_pontos
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete bonus_funcao_pontos" ON public.bonus_funcao_pontos
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Seed data
INSERT INTO public.bonus_funcao_pontos (funcao, carga_horaria, pontos) VALUES
  ('GARÇONETE PLENA', 180, 4.9),
  ('GARÇOM PLENO', 180, 4.9),
  ('GARÇONETE JUNIOR', 220, 5),
  ('CHEFE DE RODIZIO', 220, 6),
  ('LIDER DE COZINHA', 220, 9),
  ('VICE LIDER DE COZINHA', 220, 7),
  ('PIZZAIOLO PLENO', 220, 7),
  ('PIZZAIOLO JUNIOR', 220, 5),
  ('AUXILIAR PIZZAIOLO', 220, 3),
  ('LIDER DE PRODUÇÃO', 220, 7),
  ('TELE 1', 150, 1.5),
  ('TELE 1', 90, 1),
  ('TELE 2', 180, 6.9),
  ('LIMPEZA', 180, 2.4),
  ('ADM 1', 220, 11),
  ('ADM 2', 220, 9),
  ('ADM 3', 220, 5);

-- Create bonus_10_monthly table
CREATE TABLE public.bonus_10_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  funcao text,
  carga_horaria integer,
  pontos numeric,
  pontos_override numeric,
  valor_ponto numeric,
  valor_bonus numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (collaborator_id, month, year)
);

ALTER TABLE public.bonus_10_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bonus_10_monthly" ON public.bonus_10_monthly
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert bonus_10_monthly" ON public.bonus_10_monthly
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update bonus_10_monthly" ON public.bonus_10_monthly
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete bonus_10_monthly" ON public.bonus_10_monthly
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));
