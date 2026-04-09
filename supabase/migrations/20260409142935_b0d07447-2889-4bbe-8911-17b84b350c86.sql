INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('SAIPOS_API_TOKEN', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SAIPOS_API_TOKEN' LIMIT 1), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();