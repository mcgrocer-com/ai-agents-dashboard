-- Add RPC function to sort products by failed_sync_at timestamp
-- This allows sorting products by when their ERPNext sync failed

DROP FUNCTION IF EXISTS get_products_sorted_by_failed_sync(integer,integer,boolean,text,text,boolean);

CREATE OR REPLACE FUNCTION get_products_sorted_by_failed_sync(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_ascending BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
  p_pinned_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  price NUMERIC,
  original_price NUMERIC,
  vendor TEXT,
  stock_status TEXT,
  main_image TEXT,
  images JSONB,
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
DECLARE
  is_uuid_search BOOLEAN;
BEGIN
  is_uuid_search := p_search IS NOT NULL AND
    p_search ~ '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$';

  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      sp.id,
      sp.name,
      sp.description,
      sp.price,
      sp.original_price,
      sp.vendor,
      sp.stock_status,
      sp.main_image,
      sp.images,
      sp.url,
      sp.product_id,
      sp.created_at,
      sp.updated_at,
      sp.category,
      sp.breadcrumbs,
      sp.ai_title,
      sp.ai_description,
      sp.weight,
      sp.height,
      sp.width,
      sp.length,
      sp.volumetric_weight,
      sp.variant_count,
      sp.pinned,
      pp.erpnext_updated_at,
      pp.failed_sync_at,
      pp.failed_sync_error_message,
      pp.item_code
    FROM scraped_products sp
    LEFT JOIN pending_products pp ON sp.id = pp.scraped_product_id
    WHERE
      pp.failed_sync_at IS NOT NULL
      AND (p_search IS NULL OR
       (is_uuid_search AND sp.id = p_search) OR
       (NOT is_uuid_search AND (
         sp.product_id ILIKE '%' || p_search || '%' OR
         sp.name ILIKE '%' || p_search || '%' OR
         sp.description ILIKE '%' || p_search || '%' OR
         sp.ai_title ILIKE '%' || p_search || '%' OR
         pp.ai_title ILIKE '%' || p_search || '%'
       )))
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
    CASE WHEN p_ascending THEN fp.failed_sync_at END ASC,
    CASE WHEN NOT p_ascending THEN fp.failed_sync_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_products_sorted_by_failed_sync IS
'Get scraped products sorted by failed sync timestamp (from pending_products table).
Only returns products that have failed to sync to ERPNext.
Supports search, vendor filter, and pinned-only filter.
Returns total count along with results for pagination.';
