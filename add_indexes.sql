-- Run this SQL in your Supabase SQL Editor to add performance indexes
-- This will significantly improve query performance for large datasets

-- Index for created_at sorting (used by default sort "Newest First")
CREATE INDEX IF NOT EXISTS idx_scraped_products_created_at
ON scraped_products(created_at DESC);

-- Index for updated_at sorting (used by "Recently Updated" sort)
CREATE INDEX IF NOT EXISTS idx_scraped_products_updated_at
ON scraped_products(updated_at DESC);

-- Index for vendor filtering (heavily used filter)
CREATE INDEX IF NOT EXISTS idx_scraped_products_vendor
ON scraped_products(vendor);

-- Index for vendor + created_at (compound index for filtered sorting)
CREATE INDEX IF NOT EXISTS idx_scraped_products_vendor_created_at
ON scraped_products(vendor, created_at DESC);

-- Index for vendor + updated_at (compound index for filtered sorting)
CREATE INDEX IF NOT EXISTS idx_scraped_products_vendor_updated_at
ON scraped_products(vendor, updated_at DESC);

-- Index for pinned products
CREATE INDEX IF NOT EXISTS idx_scraped_products_pinned
ON scraped_products(pinned) WHERE pinned = true;

-- Index for name and price sorting
CREATE INDEX IF NOT EXISTS idx_scraped_products_name
ON scraped_products(name);

CREATE INDEX IF NOT EXISTS idx_scraped_products_price
ON scraped_products(price);

-- Composite index for pending_products join on scraped_product_id
CREATE INDEX IF NOT EXISTS idx_pending_products_scraped_product_id
ON pending_products(scraped_product_id);

-- Index for pending_products vendor (for statistics queries)
CREATE INDEX IF NOT EXISTS idx_pending_products_vendor
ON pending_products(vendor);

-- Composite index for ERPNext sync status checks
CREATE INDEX IF NOT EXISTS idx_pending_products_sync_status
ON pending_products(vendor, erpnext_updated_at, failed_sync_at);

-- Update statistics for better query planning
ANALYZE scraped_products;
ANALYZE pending_products;

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('scraped_products', 'pending_products')
ORDER BY tablename, indexname;
