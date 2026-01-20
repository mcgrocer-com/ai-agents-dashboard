-- Add columns for price comparison cache sync tracking
-- This migration adds fields to track when cache entries have been synced to scraped_products

-- Add last_updated to price_comparison_cache
-- Tracks which cache entries have been processed by the sync cron job
-- NULL means not yet processed
ALTER TABLE price_comparison_cache
ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT NULL;

COMMENT ON COLUMN price_comparison_cache.last_updated IS
  'Timestamp when this cache entry was synced to scraped_products. NULL means not yet processed.';

-- Add scraper_updated_at to scraped_products
-- Tracks when a product was last updated from price comparison data
ALTER TABLE scraped_products
ADD COLUMN IF NOT EXISTS scraper_updated_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN scraped_products.scraper_updated_at IS
  'Timestamp of last price/stock update from price comparison sync cron job.';

-- Create partial index for efficient querying of unprocessed cache entries
-- This makes the cron job query fast by only indexing rows that need processing
CREATE INDEX IF NOT EXISTS idx_price_comparison_cache_last_updated_null
ON price_comparison_cache (created_at)
WHERE last_updated IS NULL;

-- Create index on scraper_updated_at for querying recently synced products
CREATE INDEX IF NOT EXISTS idx_scraped_products_scraper_updated_at
ON scraped_products (scraper_updated_at)
WHERE scraper_updated_at IS NOT NULL;
