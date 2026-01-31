-- Add FAQ support to all activity-related RPC functions
-- Also adds copyright_status to get_recent_products_by_vendor which was missing

-- ============================================================================
-- Function 1: get_processing_products
-- Add faq_status to return type and processing logic
-- ============================================================================

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
  faq_status TEXT,
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

  -- Reset faq_status
  UPDATE pending_products pp
  SET faq_status = 'pending'
  WHERE pp.faq_status = 'processing'
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
    pp.faq_status::TEXT,
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
    OR pp.faq_status = 'processing'
  ORDER BY pp.updated_at DESC
  LIMIT row_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_processing_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_products TO anon;

COMMENT ON FUNCTION get_processing_products IS
'Fetches products currently being processed by agents (category, weight_dimension, seo, copyright, faq). Automatically resets stale products (processing > 5 min) back to pending before returning results.';

-- ============================================================================
-- Function 2: get_activity_stats
-- Add FAQ filter support
-- ============================================================================

DROP FUNCTION IF EXISTS get_activity_stats(TEXT[], TEXT);

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
  check_copyright BOOLEAN;
  check_faq BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);
  check_copyright := 'copyright' = ANY(agent_filters);
  check_faq := 'faq' = ANY(agent_filters);

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
    AND (NOT check_seo OR pp.seo_status = 'complete')
    AND (NOT check_copyright OR pp.copyright_status = 'complete')
    AND (NOT check_faq OR pp.faq_status = 'complete');
END;
$$;

GRANT EXECUTE ON FUNCTION get_activity_stats TO authenticated;

COMMENT ON FUNCTION get_activity_stats IS
'Returns activity counts (today, this week, this month, last month) for products where ALL selected agents have complete status (AND logic). Supports category, weight_dimension, seo, copyright, and faq filters.';

-- ============================================================================
-- Function 3: get_vendors_by_agent
-- Add FAQ and copyright filter support
-- ============================================================================

DROP FUNCTION IF EXISTS get_vendors_by_agent(TEXT[]);

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
  check_copyright BOOLEAN;
  check_faq BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);
  check_copyright := 'copyright' = ANY(agent_filters);
  check_faq := 'faq' = ANY(agent_filters);

  RETURN QUERY
  SELECT
    sp.vendor,
    COUNT(DISTINCT pp.id) AS product_count
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    -- ALL selected agents must be 'complete' (AND logic)
    (NOT check_category OR pp.category_status = 'complete')
    AND (NOT check_weight_dimension OR pp.weight_and_dimension_status = 'complete')
    AND (NOT check_seo OR pp.seo_status = 'complete')
    AND (NOT check_copyright OR pp.copyright_status = 'complete')
    AND (NOT check_faq OR pp.faq_status = 'complete')
  GROUP BY sp.vendor
  ORDER BY product_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_vendors_by_agent TO authenticated;

COMMENT ON FUNCTION get_vendors_by_agent IS
'Returns list of vendors with product counts where ALL selected agents have complete status (AND logic). Supports category, weight_dimension, seo, copyright, and faq filters.';

-- ============================================================================
-- Function 4: get_recent_products_by_vendor
-- Add FAQ and copyright status to return type and filter support
-- ============================================================================

DROP FUNCTION IF EXISTS get_recent_products_by_vendor(TEXT, TEXT[], INT);

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
  copyright_status TEXT,
  faq_status TEXT,
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
  check_copyright BOOLEAN;
  check_faq BOOLEAN;
BEGIN
  -- Parse agent filters
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);
  check_copyright := 'copyright' = ANY(agent_filters);
  check_faq := 'faq' = ANY(agent_filters);

  RETURN QUERY
  SELECT
    pp.id,
    pp.scraped_product_id,
    pp.category_status::TEXT,
    pp.weight_and_dimension_status::TEXT,
    pp.seo_status::TEXT,
    pp.copyright_status::TEXT,
    pp.faq_status::TEXT,
    pp.updated_at,
    sp.name AS product_name,
    sp.vendor,
    sp.main_image
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE
    (vendor_filter IS NULL OR sp.vendor = vendor_filter)
    -- ALL selected agents must be 'complete' (AND logic)
    AND (NOT check_category OR pp.category_status = 'complete')
    AND (NOT check_weight_dimension OR pp.weight_and_dimension_status = 'complete')
    AND (NOT check_seo OR pp.seo_status = 'complete')
    AND (NOT check_copyright OR pp.copyright_status = 'complete')
    AND (NOT check_faq OR pp.faq_status = 'complete')
  ORDER BY pp.updated_at DESC
  LIMIT row_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_products_by_vendor TO authenticated;

COMMENT ON FUNCTION get_recent_products_by_vendor IS
'Returns recent products filtered by vendor where ALL selected agents have complete status (AND logic). Supports category, weight_dimension, seo, copyright, and faq filters.';
