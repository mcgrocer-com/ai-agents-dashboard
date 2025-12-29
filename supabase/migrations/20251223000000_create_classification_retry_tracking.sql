-- Create table to track classification retry attempts
-- This table stores retry metadata for failed product classifications
-- to prevent infinite loops and track retry history

CREATE TABLE IF NOT EXISTS public.classification_retry_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_product_id TEXT NOT NULL REFERENCES scraped_products(id) ON DELETE CASCADE,

  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Classification attempt details
  last_error TEXT,
  last_error_type TEXT CHECK (last_error_type IN ('quota_exceeded', 'server_error', 'network_error', 'validation_error', 'unknown')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'completed', 'failed', 'max_retries_reached')),

  -- Product snapshot for debugging
  product_name TEXT,
  product_vendor TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one entry per product
  UNIQUE(scraped_product_id)
);

-- Create index for efficient querying of products due for retry
CREATE INDEX idx_classification_retry_next_retry
  ON classification_retry_log(next_retry_at, status)
  WHERE status IN ('pending', 'retrying');

-- Create index for efficient querying by scraped_product_id
CREATE INDEX idx_classification_retry_product
  ON classification_retry_log(scraped_product_id);

-- Create index for status-based queries
CREATE INDEX idx_classification_retry_status
  ON classification_retry_log(status, updated_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_classification_retry_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classification_retry_log_timestamp
  BEFORE UPDATE ON classification_retry_log
  FOR EACH ROW
  EXECUTE FUNCTION update_classification_retry_log_updated_at();

-- Add comments for documentation
COMMENT ON TABLE classification_retry_log IS 'Tracks retry attempts for failed product classifications to prevent infinite loops';
COMMENT ON COLUMN classification_retry_log.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN classification_retry_log.max_retries IS 'Maximum number of retries allowed (default: 3)';
COMMENT ON COLUMN classification_retry_log.next_retry_at IS 'Timestamp when next retry should occur (exponential backoff)';
COMMENT ON COLUMN classification_retry_log.last_error_type IS 'Type of last error encountered for retry strategy';
COMMENT ON COLUMN classification_retry_log.status IS 'Current retry status: pending, retrying, completed, failed, max_retries_reached';
