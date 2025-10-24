-- Add progress tracking columns to job_queue table
-- Run this in Supabase SQL Editor
ALTER TABLE job_queue
ADD COLUMN IF NOT EXISTS products_processed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_successful INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_failed INTEGER NOT NULL DEFAULT 0;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'job_queue'
ORDER BY ordinal_position;
