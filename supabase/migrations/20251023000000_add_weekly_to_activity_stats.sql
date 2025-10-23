-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_activity_stats(TEXT[], TEXT);

-- Recreate get_activity_stats RPC function with weekly stats
CREATE OR REPLACE FUNCTION get_activity_stats(
  agent_filters TEXT[],
  vendor_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  today_count BIGINT,
  this_week_count BIGINT,
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
      WHEN pp.updated_at >= DATE_TRUNC('week', CURRENT_DATE) THEN pp.id
      ELSE NULL
    END) AS this_week_count,
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
    -- ALL selected agents must be 'complete' (AND logic)
    AND (NOT check_category OR pp.category_status = 'complete')
    AND (NOT check_weight_dimension OR pp.weight_and_dimension_status = 'complete')
    AND (NOT check_seo OR pp.seo_status = 'complete');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_activity_stats TO authenticated;

-- Update comment
COMMENT ON FUNCTION get_activity_stats IS
'Returns activity counts (today, this week, this month, last month) for complete products filtered by agents and vendor';
