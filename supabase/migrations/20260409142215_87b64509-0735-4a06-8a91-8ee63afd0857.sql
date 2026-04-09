
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can select app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can insert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete app_settings"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access app_settings"
  ON public.app_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
