
-- Add ponto_online to collaborators
ALTER TABLE public.collaborators
ADD COLUMN ponto_online boolean NOT NULL DEFAULT false;

-- Create online_punch_records table
CREATE TABLE public.online_punch_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  punch_time timestamptz NOT NULL DEFAULT now(),
  device_ip text,
  device_user_agent text,
  created_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.online_punch_records ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access online_punch_records"
ON public.online_punch_records
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Collaborators can view own records (via usuarios.collaborator_id)
CREATE POLICY "Collaborator can view own punches"
ON public.online_punch_records
FOR SELECT
TO authenticated
USING (
  collaborator_id = (SELECT collaborator_id FROM public.usuarios WHERE id = auth.uid())
);

-- Collaborators can insert own records
CREATE POLICY "Collaborator can insert own punches"
ON public.online_punch_records
FOR INSERT
TO authenticated
WITH CHECK (
  collaborator_id = (SELECT collaborator_id FROM public.usuarios WHERE id = auth.uid())
  AND created_by = auth.uid()
);

-- Index for performance
CREATE INDEX idx_online_punch_records_collaborator_date
ON public.online_punch_records (collaborator_id, punch_time);
