-- Push quotidien Zip : journal + cron 8h (Abidjan = UTC)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.zip_daily_push_sent (
  puzzle_date date PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_disabled integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.zip_daily_push_sent IS
  'Trace des envois push quotidiens du défi Zip (idempotence cron).';

ALTER TABLE public.zip_daily_push_sent ENABLE ROW LEVEL SECURITY;

-- Cron : 8h00 Africa/Abidjan (UTC+0)
DO $zip_cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zip-daily-challenge-push') THEN
    PERFORM cron.unschedule('zip-daily-challenge-push');
  END IF;

  PERFORM cron.schedule(
    'zip-daily-challenge-push',
    '0 8 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://hqzgndjbxzgsyfoictgo.supabase.co/functions/v1/zip-daily-challenge-push',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemdubmpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NTQ5NjMsImV4cCI6MjA2MDUzMDk2M30.xHnPaHM_pdmqN6s8lxm3yq6F_cWKAzwV9AT7WvDQJYo"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
    $cron$
  );
END
$zip_cron$;
