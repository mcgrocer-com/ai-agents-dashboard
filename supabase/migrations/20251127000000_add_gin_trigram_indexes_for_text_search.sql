-- Add pg_trgm extension and GIN indexes for efficient ILIKE text search
-- This fixes "canceling statement due to statement timeout" errors when searching products

-- Enable the pg_trgm extension (required for GIN trigram indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on name column for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_scraped_products_name_trgm
ON scraped_products USING GIN (name gin_trgm_ops);

-- Create GIN trigram index on description column for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_scraped_products_description_trgm
ON scraped_products USING GIN (description gin_trgm_ops);

-- Update table statistics for better query planning
ANALYZE scraped_products;
