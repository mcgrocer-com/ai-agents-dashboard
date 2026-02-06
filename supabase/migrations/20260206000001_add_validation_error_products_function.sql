-- Add RPC function to get products with validation errors
-- This allows filtering products that have validation_error IS NOT NULL in pending_products

DROP FUNCTION IF EXISTS get_products_with_validation_errors(integer,integer,boolean,text,text,text);

CREATE OR REPLACE FUNCTION get_products_with_validation_errors(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_ascending BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'updated_at'
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
  validation_error TEXT,
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
      pp.item_code,
      pp.validation_error
    FROM scraped_products sp
    INNER JOIN pending_products pp ON sp.id = pp.scraped_product_id
    WHERE
      pp.validation_error IS NOT NULL
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
    CASE WHEN p_sort_by = 'updated_at' AND p_ascending THEN fp.updated_at END ASC,
    CASE WHEN p_sort_by = 'updated_at' AND NOT p_ascending THEN fp.updated_at END DESC,
    CASE WHEN p_sort_by = 'created_at' AND p_ascending THEN fp.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at' AND NOT p_ascending THEN fp.created_at END DESC,
    CASE WHEN p_sort_by = 'name' AND p_ascending THEN fp.name END ASC,
    CASE WHEN p_sort_by = 'name' AND NOT p_ascending THEN fp.name END DESC,
    CASE WHEN p_sort_by = 'price' AND p_ascending THEN fp.price END ASC,
    CASE WHEN p_sort_by = 'price' AND NOT p_ascending THEN fp.price END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_products_with_validation_errors IS
'Get scraped products that have validation errors (from pending_products table).
Only returns products where validation_error IS NOT NULL.
Supports search, vendor filter, and multiple sort options.
Returns total count along with results for pagination.';
