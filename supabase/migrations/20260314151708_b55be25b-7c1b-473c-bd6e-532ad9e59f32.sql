
CREATE TABLE public.freelancers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  sector TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, sector)
);

ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view freelancers" ON public.freelancers FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert freelancers" ON public.freelancers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update freelancers" ON public.freelancers FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete freelancers" ON public.freelancers FOR DELETE TO public USING (true);
