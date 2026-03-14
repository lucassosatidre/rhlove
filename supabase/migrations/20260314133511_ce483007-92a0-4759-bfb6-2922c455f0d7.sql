CREATE TABLE public.daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  faturamento_total NUMERIC NOT NULL DEFAULT 0,
  pedidos_totais INTEGER NOT NULL DEFAULT 0,
  faturamento_salao NUMERIC NOT NULL DEFAULT 0,
  pedidos_salao INTEGER NOT NULL DEFAULT 0,
  faturamento_tele NUMERIC NOT NULL DEFAULT 0,
  pedidos_tele INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily_sales" ON public.daily_sales FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert daily_sales" ON public.daily_sales FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update daily_sales" ON public.daily_sales FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete daily_sales" ON public.daily_sales FOR DELETE TO public USING (true);

CREATE TRIGGER update_daily_sales_updated_at
  BEFORE UPDATE ON public.daily_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();