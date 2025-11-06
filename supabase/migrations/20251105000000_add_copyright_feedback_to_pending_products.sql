-- Add copyright_feedback field to pending_products table
-- This field was missing from the original feedback fields migration

ALTER TABLE pending_products
ADD COLUMN IF NOT EXISTS copyright_feedback TEXT;

COMMENT ON COLUMN pending_products.copyright_feedback IS 'Optional feedback/guidance for copyright agent retry attempts';
