ALTER TABLE public.collaborators ADD COLUMN cpf text NULL;
ALTER TABLE public.collaborators ADD COLUMN matricula text NULL;

UPDATE public.collaborators
SET cpf = pis_matricula
WHERE pis_matricula IS NOT NULL AND pis_matricula <> '';