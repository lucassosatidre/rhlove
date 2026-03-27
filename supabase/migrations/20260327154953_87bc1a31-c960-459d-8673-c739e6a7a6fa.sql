ALTER TABLE public.punch_records 
  ADD COLUMN IF NOT EXISTS adjusted_by uuid,
  ADD COLUMN IF NOT EXISTS adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjustment_reason text;