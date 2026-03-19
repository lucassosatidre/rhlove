
-- Create manutencoes table
CREATE TABLE public.manutencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  collaborator_name text NOT NULL,
  description text NOT NULL,
  sector text DEFAULT '',
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'solicitado',
  observation text DEFAULT '',
  photo_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view manutencoes" ON public.manutencoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own manutencoes" ON public.manutencoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Authenticated can update manutencoes" ON public.manutencoes
  FOR UPDATE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_manutencoes_updated_at
  BEFORE UPDATE ON public.manutencoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('manutencao-fotos', 'manutencao-fotos', true);

-- Storage policies
CREATE POLICY "Authenticated can upload manutencao fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manutencao-fotos');

CREATE POLICY "Anyone can view manutencao fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'manutencao-fotos');
