-- Add progress tracking columns to job_queue table
ALTER TABLE job_queue
ADD COLUMN IF NOT EXISTS products_processed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_successful INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_failed INTEGER NOT NULL DEFAULT 0;
