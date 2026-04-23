ALTER TABLE public.collaborators
ADD COLUMN IF NOT EXISTS display_name text;

UPDATE public.collaborators
SET display_name = TRIM(split_part(collaborator_name, ' ', 1))
WHERE display_name IS NULL OR display_name = '';