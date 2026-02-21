-- Fix statement timeout on Validation Issues tab when filtering by error category
-- Root cause: sorting by sp.updated_at requires joining all 13.5k matching rows to
-- the 371MB scraped_products heap before pagination. Even with a covering index,
-- 13.5k random B-tree lookups take 12-15s on shared infrastructure.
--
-- Fix: two-phase query approach
--   FAST PATH (no search, sort by updated_at/created_at — the 99% case):
--     1. Filter + sort + paginate entirely within pending_products (uses pp.updated_at)
--     2. Join only the 20-row page to scraped_products for display columns
--     Performance: 234ms vs 14.2s (60x faster)
--   SLOW PATH (text search or name/price sort):
--     Original join query (unavoidable, but these are rare operations)
--
-- Also optimizes the count query to skip the join for vendor-only filters
-- (pp.vendor exists on pending_products, no need to join scraped_products)

-- Covering index: allows index-only scan for the 20-row final join sort
-- Stores sort columns (updated_at, created_at, name, price) in the index
-- so Postgres can verify sort order without fetching from the 371MB heap
CREATE INDEX IF NOT EXISTS idx_scraped_products_id_cover_sort
ON scraped_products (id) INCLUDE (updated_at, created_at, name, price);

-- Rewrite function with two-phase approach
DROP FUNCTION IF EXISTS get_products_with_validation_errors(integer,integer,boolean,text,text,text,text);

CREATE OR REPLACE FUNCTION get_products_with_validation_errors(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_ascending BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'updated_at',
  p_error_category TEXT DEFAULT NULL
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
  v_total BIGINT;
BEGIN
  is_uuid_search := p_search IS NOT NULL AND
    p_search ~ '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$';

  -- Optimized count: skip the join when no text search (vendor filter uses pp.vendor)
  IF p_search IS NULL THEN
    SELECT COUNT(*) INTO v_total
    FROM pending_products pp
    WHERE pp.validation_error IS NOT NULL
      AND (p_error_category IS NULL
        OR (p_error_category = 'http_error' AND pp.validation_error LIKE 'Main image HTTP %')
        OR (p_error_category = 'timeout' AND pp.validation_error LIKE 'Main image timeout%')
        OR (p_error_category = 'unreachable' AND pp.validation_error LIKE 'Main image unreachable%')
        OR (p_error_category = 'post_processing' AND pp.validation_error LIKE 'Post-processing%')
        OR (p_error_category = 'image_mismatch' AND pp.validation_error LIKE 'Image mismatch%')
      )
      AND (p_vendor IS NULL OR pp.vendor = p_vendor);
  ELSE
    SELECT COUNT(*) INTO v_total
    FROM pending_products pp
    INNER JOIN scraped_products sp ON sp.id = pp.scraped_product_id
    WHERE
      pp.validation_error IS NOT NULL
      AND (p_error_category IS NULL
        OR (p_error_category = 'http_error' AND pp.validation_error LIKE 'Main image HTTP %')
        OR (p_error_category = 'timeout' AND pp.validation_error LIKE 'Main image timeout%')
        OR (p_error_category = 'unreachable' AND pp.validation_error LIKE 'Main image unreachable%')
        OR (p_error_category = 'post_processing' AND pp.validation_error LIKE 'Post-processing%')
        OR (p_error_category = 'image_mismatch' AND pp.validation_error LIKE 'Image mismatch%')
      )
      AND (
       (is_uuid_search AND sp.id = p_search) OR
       (NOT is_uuid_search AND (
         sp.product_id ILIKE '%' || p_search || '%' OR
         sp.name ILIKE '%' || p_search || '%' OR
         sp.description ILIKE '%' || p_search || '%' OR
         sp.ai_title ILIKE '%' || p_search || '%' OR
         pp.ai_title ILIKE '%' || p_search || '%'
       )))
      AND (p_vendor IS NULL OR sp.vendor = p_vendor);
  END IF;

  -- FAST PATH: no text search and sort column exists on pending_products
  -- Sort + paginate entirely within pending_products, then join only the page
  -- to scraped_products for display columns. Avoids 13.5k cross-table lookups.
  IF p_search IS NULL AND p_sort_by IN ('updated_at', 'created_at') THEN
    RETURN QUERY
    WITH page AS MATERIALIZED (
      SELECT pp.scraped_product_id, pp.erpnext_updated_at, pp.failed_sync_at,
             pp.failed_sync_error_message, pp.item_code, pp.validation_error
      FROM pending_products pp
      WHERE pp.validation_error IS NOT NULL
        AND (p_error_category IS NULL
          OR (p_error_category = 'http_error' AND pp.validation_error LIKE 'Main image HTTP %')
          OR (p_error_category = 'timeout' AND pp.validation_error LIKE 'Main image timeout%')
          OR (p_error_category = 'unreachable' AND pp.validation_error LIKE 'Main image unreachable%')
          OR (p_error_category = 'post_processing' AND pp.validation_error LIKE 'Post-processing%')
          OR (p_error_category = 'image_mismatch' AND pp.validation_error LIKE 'Image mismatch%')
        )
        AND (p_vendor IS NULL OR pp.vendor = p_vendor)
      ORDER BY
        CASE WHEN p_sort_by = 'updated_at' AND p_ascending THEN pp.updated_at END ASC,
        CASE WHEN p_sort_by = 'updated_at' AND NOT p_ascending THEN pp.updated_at END DESC,
        CASE WHEN p_sort_by = 'created_at' AND p_ascending THEN pp.created_at END ASC,
        CASE WHEN p_sort_by = 'created_at' AND NOT p_ascending THEN pp.created_at END DESC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT
      sp.id, sp.name, sp.description, sp.price, sp.original_price,
      sp.vendor, sp.stock_status, sp.main_image, sp.images, sp.url,
      sp.product_id, sp.created_at, sp.updated_at, sp.category,
      sp.breadcrumbs, sp.ai_title, sp.ai_description,
      sp.weight, sp.height, sp.width, sp.length, sp.volumetric_weight,
      sp.variant_count, sp.pinned,
      page.erpnext_updated_at, page.failed_sync_at, page.failed_sync_error_message,
      page.item_code, page.validation_error,
      v_total
    FROM page
    JOIN scraped_products sp ON sp.id = page.scraped_product_id
    ORDER BY
      CASE WHEN p_sort_by = 'updated_at' AND p_ascending THEN sp.updated_at END ASC,
      CASE WHEN p_sort_by = 'updated_at' AND NOT p_ascending THEN sp.updated_at END DESC,
      CASE WHEN p_sort_by = 'created_at' AND p_ascending THEN sp.created_at END ASC,
      CASE WHEN p_sort_by = 'created_at' AND NOT p_ascending THEN sp.created_at END DESC;

  ELSE
    -- SLOW PATH: text search or name/price sort requires full join to scraped_products
    RETURN QUERY
    SELECT
      sp.id, sp.name, sp.description, sp.price, sp.original_price,
      sp.vendor, sp.stock_status, sp.main_image, sp.images, sp.url,
      sp.product_id, sp.created_at, sp.updated_at, sp.category,
      sp.breadcrumbs, sp.ai_title, sp.ai_description,
      sp.weight, sp.height, sp.width, sp.length, sp.volumetric_weight,
      sp.variant_count, sp.pinned,
      pp.erpnext_updated_at, pp.failed_sync_at, pp.failed_sync_error_message,
      pp.item_code, pp.validation_error,
      v_total
    FROM scraped_products sp
    INNER JOIN pending_products pp ON sp.id = pp.scraped_product_id
    WHERE
      pp.validation_error IS NOT NULL
      AND (p_error_category IS NULL
        OR (p_error_category = 'http_error' AND pp.validation_error LIKE 'Main image HTTP %')
        OR (p_error_category = 'timeout' AND pp.validation_error LIKE 'Main image timeout%')
        OR (p_error_category = 'unreachable' AND pp.validation_error LIKE 'Main image unreachable%')
        OR (p_error_category = 'post_processing' AND pp.validation_error LIKE 'Post-processing%')
        OR (p_error_category = 'image_mismatch' AND pp.validation_error LIKE 'Image mismatch%')
      )
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
    ORDER BY
      CASE WHEN p_sort_by = 'updated_at' AND p_ascending THEN sp.updated_at END ASC,
      CASE WHEN p_sort_by = 'updated_at' AND NOT p_ascending THEN sp.updated_at END DESC,
      CASE WHEN p_sort_by = 'created_at' AND p_ascending THEN sp.created_at END ASC,
      CASE WHEN p_sort_by = 'created_at' AND NOT p_ascending THEN sp.created_at END DESC,
      CASE WHEN p_sort_by = 'name' AND p_ascending THEN sp.name END ASC,
      CASE WHEN p_sort_by = 'name' AND NOT p_ascending THEN sp.name END DESC,
      CASE WHEN p_sort_by = 'price' AND p_ascending THEN sp.price END ASC,
      CASE WHEN p_sort_by = 'price' AND NOT p_ascending THEN sp.price END DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_products_with_validation_errors IS
'Get scraped products that have validation errors (from pending_products table).
Supports filtering by error category: http_error, timeout, unreachable, post_processing, image_mismatch.
Uses two-phase approach for fast sorting: paginate in pending_products, join only the page to scraped_products.
Returns total count along with results for pagination.';

ANALYZE pending_products;
ANALYZE scraped_products;
