ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS intervalo_automatico boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS intervalo_inicio text,
ADD COLUMN IF NOT EXISTS intervalo_duracao integer;