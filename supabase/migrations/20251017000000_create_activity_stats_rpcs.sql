-- Create RPC functions for activity statistics and vendor filtering
-- These functions support the Recent Activity component

-- Function 1: Get activity statistics (counts by time period)
CREATE OR REPLACE FUNCTION get_activity_stats(
  agent_filters TEXT[],
  vendor_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  today_count BIGINT,
  this_month_count BIGINT,
  last_month_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  check_category BOOLEAN;
  check_weight_dimension BOOLEAN;
  check_seo BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);

  RETURN QUERY
  SELECT
    COUNT(DISTINCT CASE
      WHEN pp.updated_at >= CURRENT_DATE THEN pp.id
      ELSE NULL
    END) AS today_count,
    COUNT(DISTINCT CASE
      WHEN pp.updated_at >= DATE_TRUNC('month', CURRENT_DATE) THEN pp.id
      ELSE NULL
    END) AS this_month_count,
    COUNT(DISTINCT CASE
      WHEN pp.updated_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND pp.updated_at < DATE_TRUNC('month', CURRENT_DATE) THEN pp.id
      ELSE NULL
    END) AS last_month_count
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    (vendor_filter IS NULL OR sp.vendor = vendor_filter)
    AND (
      (check_category AND pp.category_status = 'complete')
      OR (check_weight_dimension AND pp.weight_and_dimension_status = 'complete')
      OR (check_seo AND pp.seo_status = 'complete')
    );
END;
$$;

-- Function 2: Get vendors with product counts by agent
CREATE OR REPLACE FUNCTION get_vendors_by_agent(
  agent_filters TEXT[]
)
RETURNS TABLE (
  vendor TEXT,
  product_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  check_category BOOLEAN;
  check_weight_dimension BOOLEAN;
  check_seo BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);

  RETURN QUERY
  SELECT
    sp.vendor,
    COUNT(DISTINCT pp.id) AS product_count
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    (check_category AND pp.category_status = 'complete')
    OR (check_weight_dimension AND pp.weight_and_dimension_status = 'complete')
    OR (check_seo AND pp.seo_status = 'complete')
  GROUP BY sp.vendor
  ORDER BY product_count DESC;
END;
$$;

-- Function 3: Get recent products by vendor with agent filtering
CREATE OR REPLACE FUNCTION get_recent_products_by_vendor(
  vendor_filter TEXT,
  agent_filters TEXT[],
  row_limit INT DEFAULT 20
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
  check_category BOOLEAN;
  check_weight_dimension BOOLEAN;
  check_seo BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);

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
    (vendor_filter IS NULL OR sp.vendor = vendor_filter)
    AND (
      (check_category AND pp.category_status = 'complete')
      OR (check_weight_dimension AND pp.weight_and_dimension_status = 'complete')
      OR (check_seo AND pp.seo_status = 'complete')
    )
  ORDER BY pp.updated_at DESC
  LIMIT row_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_activity_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendors_by_agent TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_products_by_vendor TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_activity_stats IS
'Returns activity counts (today, this month, last month) for complete products filtered by agents and vendor';

COMMENT ON FUNCTION get_vendors_by_agent IS
'Returns list of vendors with their product counts filtered by agent completion status';

COMMENT ON FUNCTION get_recent_products_by_vendor IS
'Returns recent products filtered by vendor and agent, ordered by most recent updates';
