-- Désactivation temporaire du push quotidien Zip (jeu pas encore sur les stores).
-- Réactiver plus tard via une migration qui reschedule 'zip-daily-challenge-push'.

DO $zip_cron_off$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zip-daily-challenge-push') THEN
    PERFORM cron.unschedule('zip-daily-challenge-push');
  END IF;
END
$zip_cron_off$;

COMMENT ON TABLE public.zip_daily_push_sent IS
  'Trace des envois push quotidiens du défi Zip (cron désactivé en attente release store).';
