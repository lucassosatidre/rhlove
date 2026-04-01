
CREATE TABLE public.payroll_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  template_file_name TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  data_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

ALTER TABLE public.payroll_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor can select payroll_closings" ON public.payroll_closings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert payroll_closings" ON public.payroll_closings
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update payroll_closings" ON public.payroll_closings
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete payroll_closings" ON public.payroll_closings
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));
