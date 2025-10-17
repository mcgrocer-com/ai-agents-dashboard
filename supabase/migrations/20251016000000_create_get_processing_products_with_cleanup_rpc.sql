-- Create RPC function to get processing products with automatic cleanup of stale products
-- Resets products stuck in 'processing' for more than 5 minutes back to 'pending'

CREATE OR REPLACE FUNCTION get_processing_products_with_cleanup(
  row_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  scraped_product_id TEXT,
  category_status TEXT,
  weight_and_dimension_status TEXT,
  seo_status TEXT,
  updated_at TIMESTAMPTZ,
  product_name TEXT,
  vendor TEXT,
  main_image TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  five_minutes_ago TIMESTAMPTZ;
BEGIN
  -- Calculate timestamp for 5 minutes ago
  five_minutes_ago := NOW() - INTERVAL '5 minutes';

  -- Step 1: Cleanup - Reset stale processing products back to pending

  -- Reset category_status
  UPDATE pending_products pp
  SET category_status = 'pending'
  WHERE pp.category_status = 'processing'
    AND pp.updated_at < five_minutes_ago;

  -- Reset weight_and_dimension_status
  UPDATE pending_products pp
  SET weight_and_dimension_status = 'pending'
  WHERE pp.weight_and_dimension_status = 'processing'
    AND pp.updated_at < five_minutes_ago;

  -- Reset seo_status
  UPDATE pending_products pp
  SET seo_status = 'pending'
  WHERE pp.seo_status = 'processing'
    AND pp.updated_at < five_minutes_ago;

  -- Step 2: Return current processing products
  RETURN QUERY
  SELECT
    pp.id,
    pp.scraped_product_id,
    pp.category_status::TEXT,
    pp.weight_and_dimension_status::TEXT,
    pp.seo_status::TEXT,
    pp.updated_at,
    sp.name AS product_name,
    sp.vendor,
    sp.main_image
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    pp.category_status = 'processing'
    OR pp.weight_and_dimension_status = 'processing'
    OR pp.seo_status = 'processing'
  ORDER BY pp.updated_at DESC
  LIMIT row_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_processing_products_with_cleanup TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_processing_products_with_cleanup IS
'Fetches products currently being processed by agents. Automatically resets stale products (processing > 5 min) back to pending before returning results.';
