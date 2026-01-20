-- Set up pg_cron job for syncing price comparison cache to scraped_products
-- This cron job runs every 15 minutes to sync fresh price/availability data

-- IMPORTANT: Before running this migration, you must:
-- 1. Have project_url and service_role_key stored in Supabase Vault (should already exist from classification retry setup)
-- 2. Deploy the sync-price-comparison-cache edge function

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule the job if it already exists (for re-running this migration)
SELECT cron.unschedule('sync-price-comparison-cache');

-- Schedule the sync job to run every 15 minutes
SELECT cron.schedule(
  'sync-price-comparison-cache',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-price-comparison-cache',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'batchSize', 50
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
WHERE jobname = 'sync-price-comparison-cache';

-- Create a convenience function to manually trigger the sync job
CREATE OR REPLACE FUNCTION public.trigger_price_sync(
  batch_size INTEGER DEFAULT 50
)
RETURNS TABLE(request_id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-price-comparison-cache',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'batchSize', batch_size
      ),
      timeout_milliseconds := 300000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.trigger_price_sync IS
  'Manually trigger price comparison cache sync with custom batch size. Updates scraped_products with fresh price/stock data from cached search results.';

-- Example usage:
-- SELECT public.trigger_price_sync(10);

-- To check cron job history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-price-comparison-cache') ORDER BY start_time DESC LIMIT 10;

-- To disable the cron job without deleting it:
-- SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-price-comparison-cache'), active := false);

-- To re-enable the cron job:
-- SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-price-comparison-cache'), active := true);

-- To delete the cron job completely:
-- SELECT cron.unschedule('sync-price-comparison-cache');
