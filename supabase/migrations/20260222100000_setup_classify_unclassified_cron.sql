-- Set up pg_cron job for proactively classifying unclassified products
-- This cron job runs every 10 minutes to classify products that have classification IS NULL
-- in scraped_products, so they are pre-classified before any sync runs.

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the classification job to run every 10 minutes
SELECT cron.schedule(
  'classify-unclassified-products',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/classify-unclassified-products',
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
WHERE jobname = 'classify-unclassified-products';

-- Create a convenience function to manually trigger classification
CREATE OR REPLACE FUNCTION public.trigger_classify_unclassified(
  batch_size INTEGER DEFAULT 50,
  vendor_name TEXT DEFAULT NULL
)
RETURNS TABLE(request_id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/classify-unclassified-products',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'batchSize', batch_size,
        'vendor', vendor_name
      ),
      timeout_milliseconds := 300000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_classify_unclassified IS 'Manually trigger bulk classification of unclassified products';

-- Example usage:
-- SELECT public.trigger_classify_unclassified(100);           -- Classify 100 products
-- SELECT public.trigger_classify_unclassified(50, 'argos');   -- Classify 50 Argos products
