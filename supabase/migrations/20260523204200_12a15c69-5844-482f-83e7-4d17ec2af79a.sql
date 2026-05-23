-- Enable realtime
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.event_impacts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_impacts;

-- Cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule AI refresh every 15 minutes
SELECT cron.schedule(
  'geopulse-refresh-intel',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--7cef826f-0fb6-43e2-a686-4275a28646f1.lovable.app/api/public/cron-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzc3Fid2pldXpmZmx6aHhqdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NTkxOTksImV4cCI6MjA5NTEzNTE5OX0.4VB5diKLu7subqFfWxBD0jbwCfJiSL0xdp3G4OlSvV8'
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $$
);