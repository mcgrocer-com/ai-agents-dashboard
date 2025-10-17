-- Create optimized RPC function for retrieving pending products
-- This function runs entirely on the database server for better performance

-- First, ensure we have proper indexes for the query
CREATE INDEX IF NOT EXISTS idx_pending_products_vendor ON pending_products(vendor);
CREATE INDEX IF NOT EXISTS idx_pending_products_category_status ON pending_products(category_status);
CREATE INDEX IF NOT EXISTS idx_pending_products_weight_dimension_status ON pending_products(weight_and_dimension_status);
CREATE INDEX IF NOT EXISTS idx_pending_products_seo_status ON pending_products(seo_status);
CREATE INDEX IF NOT EXISTS idx_pending_products_created_at ON pending_products(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pending_products_vendor_category_status
  ON pending_products(vendor, category_status) WHERE category_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_products_vendor_weight_status
  ON pending_products(vendor, weight_and_dimension_status) WHERE weight_and_dimension_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_products_vendor_seo_status
  ON pending_products(vendor, seo_status) WHERE seo_status = 'pending';

-- Create the RPC function with optimized query
CREATE OR REPLACE FUNCTION get_pending_products_for_agent(
  p_vendor TEXT DEFAULT NULL,
  p_agent_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 500,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  item_code TEXT,
  vendor TEXT,
  scraped_product_id UUID,
  category_status TEXT,
  weight_and_dimension_status TEXT,
  seo_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  scraped_product JSONB
) AS $$
BEGIN
  -- Set local statement timeout to 10 seconds for this function
  SET LOCAL statement_timeout = '10s';

  RETURN QUERY
  SELECT
    pp.id,
    pp.item_code,
    pp.vendor,
    pp.scraped_product_id,
    pp.category_status,
    pp.weight_and_dimension_status,
    pp.seo_status,
    pp.created_at,
    pp.updated_at,
    -- Build JSONB object from scraped_products table
    jsonb_build_object(
      'name', sp.name,
      'price', sp.price,
      'description', sp.description,
      'main_image', sp.main_image,
      'images', sp.images,
      'weight', sp.weight,
      'category', sp.category,
      'url', sp.url,
      'breadcrumbs', sp.breadcrumbs,
      'product_id', sp.product_id
    ) as scraped_product
  FROM pending_products pp
  LEFT JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    -- Vendor filter (optional)
    (p_vendor IS NULL OR pp.vendor = p_vendor)
    AND
    -- Agent-specific status filter
    (
      (p_agent_type IS NULL) OR
      (p_agent_type = 'category' AND pp.category_status = 'pending') OR
      (p_agent_type = 'weight_dimension' AND pp.weight_and_dimension_status = 'pending') OR
      (p_agent_type = 'seo' AND pp.seo_status = 'pending')
    )
  ORDER BY pp.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_pending_products_for_agent TO authenticated, service_role;

-- Add comment explaining the function
COMMENT ON FUNCTION get_pending_products_for_agent IS
'Efficiently retrieves pending products for agent processing with vendor and agent-type filtering.
Includes joined scraped_product data as JSONB. Uses indexes and server-side processing to avoid timeouts.';
