-- RPC function to get products sorted by erpnext_updated_at from pending_products
-- This allows sorting by joined table columns that PostgREST doesn't support natively

CREATE OR REPLACE FUNCTION get_products_sorted_by_erpnext_sync(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_ascending BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
  p_pinned_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  original_price NUMERIC,
  vendor TEXT,
  stock_status TEXT,
  main_image TEXT,
  images TEXT[],
  url TEXT,
  product_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category TEXT,
  breadcrumbs JSONB,
  ai_title TEXT,
  ai_description TEXT,
  weight NUMERIC,
  height NUMERIC,
  width NUMERIC,
  length NUMERIC,
  volumetric_weight NUMERIC,
  variant_count INTEGER,
  pinned BOOLEAN,
  erpnext_updated_at TIMESTAMPTZ,
  failed_sync_at TIMESTAMPTZ,
  failed_sync_error_message TEXT,
  item_code TEXT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      sp.*,
      pp.erpnext_updated_at,
      pp.failed_sync_at,
      pp.failed_sync_error_message,
      pp.item_code
    FROM scraped_products sp
    LEFT JOIN pending_products pp ON sp.id = pp.scraped_product_id
    WHERE
      (p_search IS NULL OR sp.name ILIKE '%' || p_search || '%' OR sp.description ILIKE '%' || p_search || '%')
      AND (p_vendor IS NULL OR sp.vendor = p_vendor)
      AND (NOT p_pinned_only OR sp.pinned = TRUE)
  ),
  counted AS (
    SELECT COUNT(*) as total FROM filtered_products
  )
  SELECT
    fp.*,
    c.total as total_count
  FROM filtered_products fp
  CROSS JOIN counted c
  ORDER BY
    CASE
      WHEN p_ascending THEN fp.erpnext_updated_at
    END ASC NULLS LAST,
    CASE
      WHEN NOT p_ascending THEN fp.erpnext_updated_at
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION get_products_sorted_by_erpnext_sync IS
'Get scraped products sorted by ERPNext sync timestamp (from pending_products table).
Supports search, vendor filter, and pinned-only filter.
Returns total count along with results for pagination.';
