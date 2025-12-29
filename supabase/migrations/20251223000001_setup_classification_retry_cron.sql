-- Set up pg_cron job for retrying failed product classifications
-- This cron job runs every 15 minutes to retry products that failed classification

-- IMPORTANT: Before running this migration, you must:
-- 1. Store your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Supabase Vault
-- 2. Deploy the retry-failed-classifications edge function

-- Store project URL and service role key in Vault (run these manually in SQL editor)
-- select vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule the job if it already exists (for re-running this migration)
SELECT cron.unschedule('retry-failed-classifications');

-- Schedule the retry job to run every 15 minutes
SELECT cron.schedule(
  'retry-failed-classifications',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/retry-failed-classifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'batchSize', 20,
        'forceRetry', false
      ),
      timeout_milliseconds := 300000 -- 5 minute timeout
    ) AS request_id;
  $$
);

-- Verify the cron job was created
SELECT
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'retry-failed-classifications';

-- Create a convenience function to manually trigger the retry job
CREATE OR REPLACE FUNCTION public.trigger_classification_retry(
  batch_size INTEGER DEFAULT 20,
  force_retry BOOLEAN DEFAULT false,
  vendor_name TEXT DEFAULT NULL
)
RETURNS TABLE(request_id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/retry-failed-classifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'batchSize', batch_size,
        'forceRetry', force_retry,
        'vendor', vendor_name
      ),
      timeout_milliseconds := 300000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.trigger_classification_retry IS 'Manually trigger classification retry job with custom parameters';

-- Example usage of manual trigger:
-- SELECT public.trigger_classification_retry(10, false, 'argos');

-- To check the response from the cron job:
-- SELECT * FROM net._http_response WHERE id = (SELECT request_id FROM cron.job_run_details ORDER BY start_time DESC LIMIT 1);

-- To view cron job history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications') ORDER BY start_time DESC LIMIT 10;

-- To disable the cron job without deleting it:
-- SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications'), active := false);

-- To re-enable the cron job:
-- SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications'), active := true);

-- To delete the cron job completely:
-- SELECT cron.unschedule('retry-failed-classifications');
