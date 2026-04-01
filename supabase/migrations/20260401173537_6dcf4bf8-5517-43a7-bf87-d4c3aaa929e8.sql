
-- Bank hours transactions table
CREATE TABLE public.bank_hours_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  semester_start date NOT NULL,
  transaction_date date NOT NULL,
  type text NOT NULL DEFAULT 'auto_espelho',
  description text DEFAULT '',
  credit_minutes integer NOT NULL DEFAULT 0,
  debit_minutes integer NOT NULL DEFAULT 0,
  balance_after_minutes integer NOT NULL DEFAULT 0,
  reference_month integer,
  reference_year integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_hours_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bank_hours_transactions" ON public.bank_hours_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert bank_hours_transactions" ON public.bank_hours_transactions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update bank_hours_transactions" ON public.bank_hours_transactions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete bank_hours_transactions" ON public.bank_hours_transactions FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Bank hours folgas table
CREATE TABLE public.bank_hours_folgas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  folga_date date NOT NULL,
  hours_debited integer NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_hours_folgas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bank_hours_folgas" ON public.bank_hours_folgas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert bank_hours_folgas" ON public.bank_hours_folgas FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update bank_hours_folgas" ON public.bank_hours_folgas FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete bank_hours_folgas" ON public.bank_hours_folgas FOR DELETE TO authenticated USING (is_admin(auth.uid()));
