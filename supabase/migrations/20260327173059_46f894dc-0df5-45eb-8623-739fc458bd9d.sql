
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS genero text NOT NULL DEFAULT 'M';

CREATE TABLE IF NOT EXISTS public.bank_hours_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  accumulated_balance integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (collaborator_id, month, year)
);

ALTER TABLE public.bank_hours_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bank_hours_balance" ON public.bank_hours_balance FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert bank_hours_balance" ON public.bank_hours_balance FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update bank_hours_balance" ON public.bank_hours_balance FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete bank_hours_balance" ON public.bank_hours_balance FOR DELETE TO public USING (true);
