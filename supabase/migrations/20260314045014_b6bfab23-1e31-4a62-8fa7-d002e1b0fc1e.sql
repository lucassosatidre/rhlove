
-- Create collaborators table
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  collaborator_name TEXT NOT NULL,
  weekly_day_off TEXT NOT NULL DEFAULT 'segunda',
  sunday_n INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (internal app, no auth required for now)
CREATE POLICY "Anyone can view collaborators" ON public.collaborators FOR SELECT USING (true);
CREATE POLICY "Anyone can insert collaborators" ON public.collaborators FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update collaborators" ON public.collaborators FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete collaborators" ON public.collaborators FOR DELETE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
