-- Add copyright_status support to get_processing_products function
-- Includes copyright in cleanup logic and return values

-- Drop the old function first since we're changing the return type
DROP FUNCTION IF EXISTS get_processing_products(INT);

CREATE OR REPLACE FUNCTION get_processing_products(
  row_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  scraped_product_id TEXT,
  category_status TEXT,
  weight_and_dimension_status TEXT,
  seo_status TEXT,
  copyright_status TEXT,
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

  -- Reset copyright_status
  UPDATE pending_products pp
  SET copyright_status = 'pending'
  WHERE pp.copyright_status = 'processing'
    AND pp.updated_at < five_minutes_ago;

  -- Step 2: Return current processing products
  RETURN QUERY
  SELECT
    pp.id,
    pp.scraped_product_id,
    pp.category_status::TEXT,
    pp.weight_and_dimension_status::TEXT,
    pp.seo_status::TEXT,
    pp.copyright_status::TEXT,
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
    OR pp.copyright_status = 'processing'
  ORDER BY pp.updated_at DESC
  LIMIT row_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_processing_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_products TO anon;

-- Update comment
COMMENT ON FUNCTION get_processing_products IS
'Fetches products currently being processed by agents (category, weight_dimension, seo, copyright). Automatically resets stale products (processing > 5 min) back to pending before returning results.';
