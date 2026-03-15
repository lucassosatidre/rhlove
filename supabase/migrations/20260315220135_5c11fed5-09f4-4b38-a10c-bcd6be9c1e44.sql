
CREATE TABLE public.freelancer_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  sector TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancer_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view freelancer_entries" ON public.freelancer_entries FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert freelancer_entries" ON public.freelancer_entries FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update freelancer_entries" ON public.freelancer_entries FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete freelancer_entries" ON public.freelancer_entries FOR DELETE TO public USING (true);

CREATE TRIGGER update_freelancer_entries_updated_at
  BEFORE UPDATE ON public.freelancer_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
