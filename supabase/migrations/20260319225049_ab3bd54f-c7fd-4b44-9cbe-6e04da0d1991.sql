
CREATE TABLE public.compras_insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  collaborator_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  stock_quantity TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'solicitado',
  observation TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compras_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view compras_insumos" ON public.compras_insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own compras_insumos" ON public.compras_insumos FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Authenticated can update compras_insumos" ON public.compras_insumos FOR UPDATE TO authenticated USING (true);
