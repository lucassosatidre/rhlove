
-- VT Config table
CREATE TABLE public.vt_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_passagem numeric(10,2) NOT NULL DEFAULT 7.70,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.vt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vt_config" ON public.vt_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert vt_config" ON public.vt_config FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update vt_config" ON public.vt_config FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Insert default config
INSERT INTO public.vt_config (valor_passagem) VALUES (7.70);

-- VT Monthly table
CREATE TABLE public.vt_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  saldo_cartao numeric(10,2),
  recarga_integral numeric(10,2),
  recarga_necessaria numeric(10,2),
  desconto_folha numeric(10,2),
  custo_empresa numeric(10,2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (collaborator_id, month, year)
);

ALTER TABLE public.vt_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vt_monthly" ON public.vt_monthly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vt_monthly" ON public.vt_monthly FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vt_monthly" ON public.vt_monthly FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete vt_monthly" ON public.vt_monthly FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
