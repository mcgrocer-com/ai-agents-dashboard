-- Add covering indexes to optimize agent metrics aggregation queries
-- These indexes include all columns needed for the aggregation, allowing index-only scans

-- Covering index for category agent metrics
-- Includes: status (for filtering/counting), confidence (for AVG), cost (for SUM), updated_at (for MAX)
CREATE INDEX IF NOT EXISTS idx_pending_products_category_metrics_covering
ON pending_products (category_status)
INCLUDE (category_confidence, category_cost, updated_at);

-- Covering index for weight-dimension agent metrics
CREATE INDEX IF NOT EXISTS idx_pending_products_weight_metrics_covering
ON pending_products (weight_and_dimension_status)
INCLUDE (dimension_confidence, weight_cost, updated_at);

-- Covering index for SEO agent metrics
CREATE INDEX IF NOT EXISTS idx_pending_products_seo_metrics_covering
ON pending_products (seo_status)
INCLUDE (seo_confidence, seo_cost, updated_at);

-- Add comments explaining the optimization
COMMENT ON INDEX idx_pending_products_category_metrics_covering IS
  'Covering index for category agent metrics aggregation.
  Enables index-only scans by including all columns needed for COUNT, AVG, SUM, MAX operations.';

COMMENT ON INDEX idx_pending_products_weight_metrics_covering IS
  'Covering index for weight-dimension agent metrics aggregation.
  Enables index-only scans by including all columns needed for COUNT, AVG, SUM, MAX operations.';

COMMENT ON INDEX idx_pending_products_seo_metrics_covering IS
  'Covering index for SEO agent metrics aggregation.
  Enables index-only scans by including all columns needed for COUNT, AVG, SUM, MAX operations.';
