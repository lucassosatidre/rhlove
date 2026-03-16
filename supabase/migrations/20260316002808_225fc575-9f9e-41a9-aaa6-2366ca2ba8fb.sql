
ALTER TABLE public.scheduled_vacations
  ADD COLUMN IF NOT EXISTS aviso_ferias_assinado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contabilidade_solicitada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagamento_efetuado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recibo_assinado boolean NOT NULL DEFAULT false;
