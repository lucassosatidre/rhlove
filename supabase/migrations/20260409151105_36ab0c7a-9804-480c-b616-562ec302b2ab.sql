INSERT INTO app_settings (key, value, updated_at) VALUES 
('SAIPOS_PROXY_FUNCTION_URL', 'https://hvpmkkxvvjnefayrlcjy.supabase.co/functions/v1/sync-saipos-sales', now()),
('CXLOVE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsa3p4cG91Y292ZnNmenpuZXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTg0NDEsImV4cCI6MjA4OTAzNDQ0MX0.-g0uZ7qxm0fQQfKGFYy_O6V3MVXr86bXzavu01IgYOo', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();