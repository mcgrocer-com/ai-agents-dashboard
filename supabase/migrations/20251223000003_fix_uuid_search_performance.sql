-- Fix UUID search performance by using exact match instead of ILIKE pattern matching
-- This dramatically improves query performance for UUID searches

DROP FUNCTION IF EXISTS get_products_sorted_by_erpnext_sync(integer,integer,boolean,text,text,boolean);

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
DECLARE
  is_uuid_search BOOLEAN;
BEGIN
  -- Check if search string looks like a UUID (with or without hyphens)
  is_uuid_search := p_search IS NOT NULL AND
    p_search ~ '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$';

  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      sp.*,
      pp.erpnext_updated_at,
      pp.failed_sync_at,
      pp.failed_sync_error_message,
      pp.item_code,
      pp.ai_title
    FROM scraped_products sp
    LEFT JOIN pending_products pp ON sp.id = pp.scraped_product_id
    WHERE
      (p_search IS NULL OR
       -- Use exact match for UUID search (fast)
       (is_uuid_search AND sp.id::TEXT = p_search) OR
       -- Use pattern matching for text search
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

COMMENT ON FUNCTION get_products_sorted_by_erpnext_sync IS
'Get scraped products sorted by ERPNext sync timestamp (from pending_products table).
Supports search on id (exact UUID match), product_id, name, description, and ai_title (pattern matching).
Uses intelligent query optimization: exact match for UUIDs, pattern matching for text.
Supports vendor filter and pinned-only filter.
Returns total count along with results for pagination.';
