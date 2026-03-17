-- Add fetched_at column to pending_products
-- Used by fetch-unsanitized-products edge function to track which products
-- have already been fetched by external AI agents.
ALTER TABLE pending_products
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NULL;
