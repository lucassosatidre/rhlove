
CREATE TABLE public.bonus_10_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  receita_taxa_servico numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

ALTER TABLE public.bonus_10_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can insert bonus_10_config" ON public.bonus_10_config FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update bonus_10_config" ON public.bonus_10_config FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete bonus_10_config" ON public.bonus_10_config FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated can view bonus_10_config" ON public.bonus_10_config FOR SELECT TO authenticated USING (true);
