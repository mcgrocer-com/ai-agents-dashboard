-- Better index for LIKE 'prefix%' category filtering on validation_error
-- The existing partial index (on scraped_product_id WHERE validation_error IS NOT NULL)
-- scans all 13.7k error rows then heap-filters by LIKE pattern.
-- This text_pattern_ops index lets Postgres seek directly to matching prefixes.
-- Performance: 172ms -> 7.6ms (22x faster) for category filtering.
CREATE INDEX IF NOT EXISTS idx_pending_products_validation_error_text
ON pending_products (validation_error text_pattern_ops)
WHERE validation_error IS NOT NULL;

-- RPC function to reset (clear) validation errors by category
-- Clearing validation_error allows the validation pipeline to re-check these products
CREATE OR REPLACE FUNCTION reset_validation_errors_by_category(
  p_error_category TEXT
)
RETURNS TABLE (reset_count BIGINT) AS $$
BEGIN
  IF p_error_category IS NULL OR p_error_category = '' THEN
    RAISE EXCEPTION 'p_error_category is required';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE pending_products
    SET validation_error = NULL
    WHERE validation_error IS NOT NULL
      AND (
        (p_error_category = 'http_error' AND validation_error LIKE 'Main image HTTP %')
        OR (p_error_category = 'timeout' AND validation_error LIKE 'Main image timeout%')
        OR (p_error_category = 'unreachable' AND validation_error LIKE 'Main image unreachable%')
        OR (p_error_category = 'post_processing' AND validation_error LIKE 'Post-processing%')
        OR (p_error_category = 'image_mismatch' AND validation_error LIKE 'Image mismatch%')
      )
    RETURNING 1
  )
  SELECT COUNT(*)::BIGINT FROM updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_validation_errors_by_category IS
'Clears validation_error for all products matching the given error category.
Valid categories: http_error, timeout, unreachable, post_processing, image_mismatch.
Products with cleared errors will be re-validated on the next pipeline run.';
