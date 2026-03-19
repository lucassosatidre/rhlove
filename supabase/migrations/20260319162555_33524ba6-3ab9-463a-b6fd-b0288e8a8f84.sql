
-- Create checkouts table
CREATE TABLE public.checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  collaborator_name text NOT NULL,
  checkout_date date NOT NULL DEFAULT CURRENT_DATE,
  checkout_time time NOT NULL DEFAULT CURRENT_TIME,
  duration_seconds integer NOT NULL DEFAULT 0,
  transcription text,
  transcription_status text NOT NULL DEFAULT 'pendente',
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view checkouts" ON public.checkouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own checkouts" ON public.checkouts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Authenticated can update own checkouts" ON public.checkouts
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id OR public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_checkouts_updated_at
  BEFORE UPDATE ON public.checkouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('checkout-audios', 'checkout-audios', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload checkout audios"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkout-audios');

CREATE POLICY "Authenticated users can read checkout audios"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checkout-audios');
