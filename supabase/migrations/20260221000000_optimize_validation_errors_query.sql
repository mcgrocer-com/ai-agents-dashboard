-- Fix statement timeout on Validation Issues tab
-- Root cause: no index on validation_error meant full sequential scan of 218k rows
-- The CTE approach also materialized all 13k matching rows before paginating
--
-- Changes:
-- 1. Add partial index on pending_products for validation_error IS NOT NULL
-- 2. Rewrite function to separate count from results (avoids CTE materialization)
-- 3. Skip the join for counting when no search/vendor filter (common case)

-- Partial index: only indexes the ~13k rows with validation errors
CREATE INDEX IF NOT EXISTS idx_pending_products_validation_error
ON pending_products (scraped_product_id)
WHERE validation_error IS NOT NULL;

-- Recreate function with optimized query structure + category filter
DROP FUNCTION IF EXISTS get_products_with_validation_errors(integer,integer,boolean,text,text,text);
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

  -- Optimized count: skip the join when no search/vendor filter (common case)
  IF p_search IS NULL AND p_vendor IS NULL THEN
    SELECT COUNT(*) INTO v_total
    FROM pending_products pp
    WHERE pp.validation_error IS NOT NULL
      AND (p_error_category IS NULL
        OR (p_error_category = 'http_error' AND pp.validation_error LIKE 'Main image HTTP %')
        OR (p_error_category = 'timeout' AND pp.validation_error LIKE 'Main image timeout%')
        OR (p_error_category = 'unreachable' AND pp.validation_error LIKE 'Main image unreachable%')
        OR (p_error_category = 'post_processing' AND pp.validation_error LIKE 'Post-processing%')
        OR (p_error_category = 'image_mismatch' AND pp.validation_error LIKE 'Image mismatch%')
      );
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
      AND (p_search IS NULL OR
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

  -- Return paginated results
  RETURN QUERY
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
    pp.validation_error,
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
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_products_with_validation_errors IS
'Get scraped products that have validation errors (from pending_products table).
Supports filtering by error category: http_error, timeout, unreachable, post_processing, image_mismatch.
Returns total count along with results for pagination.';

ANALYZE pending_products;

-- Also fix get_distinct_vendors which was taking 44 seconds (full table scan for GROUP BY)
-- Uses recursive CTE "skip scan" to jump between distinct vendor values in the index
DROP FUNCTION IF EXISTS get_distinct_vendors();

CREATE OR REPLACE FUNCTION get_distinct_vendors()
RETURNS TABLE (vendor VARCHAR, product_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE distinct_vendors AS (
    (SELECT pp.vendor FROM pending_products pp WHERE pp.vendor IS NOT NULL ORDER BY pp.vendor LIMIT 1)
    UNION ALL
    (SELECT (SELECT pp2.vendor FROM pending_products pp2 WHERE pp2.vendor > dv.vendor AND pp2.vendor IS NOT NULL ORDER BY pp2.vendor LIMIT 1)
     FROM distinct_vendors dv WHERE dv.vendor IS NOT NULL)
  )
  SELECT dv.vendor, COUNT(*) as product_count
  FROM distinct_vendors dv
  INNER JOIN pending_products pp ON pp.vendor = dv.vendor
  WHERE dv.vendor IS NOT NULL
  GROUP BY dv.vendor
  ORDER BY dv.vendor;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_distinct_vendors IS
'Get distinct vendors with product counts using index skip scan.
Uses recursive CTE to efficiently traverse the vendor index instead of scanning all rows.';

-- Fix get_vendors_by_agent timeout (~8s, at the 8s authenticated role limit)
-- Root cause:
--   1. Unnecessary join to scraped_products (pending_products has its own vendor column)
--   2. COUNT(DISTINCT pp.id) forces an expensive sort (id is PK, so DISTINCT is redundant)
--   3. Heap scan of 40k blocks because the status index doesn't include vendor
--
-- Fix:
--   1. Drop the join, use pp.vendor directly
--   2. Use COUNT(*) instead of COUNT(DISTINCT id)
--   3. Add covering index with vendor INCLUDE'd to avoid heap fetches

CREATE INDEX IF NOT EXISTS idx_pending_products_status_vendor
ON pending_products (category_status, weight_and_dimension_status, seo_status, copyright_status, faq_status)
INCLUDE (vendor);

DROP FUNCTION IF EXISTS get_vendors_by_agent(text[]);

CREATE OR REPLACE FUNCTION get_vendors_by_agent(agent_filters TEXT[])
RETURNS TABLE (vendor VARCHAR, product_count BIGINT) AS $$
DECLARE
  check_category BOOLEAN;
  check_weight_dimension BOOLEAN;
  check_seo BOOLEAN;
  check_copyright BOOLEAN;
  check_faq BOOLEAN;
BEGIN
  check_category := 'category' = ANY(agent_filters);
  check_weight_dimension := 'weight_dimension' = ANY(agent_filters);
  check_seo := 'seo' = ANY(agent_filters);
  check_copyright := 'copyright' = ANY(agent_filters);
  check_faq := 'faq' = ANY(agent_filters);

  RETURN QUERY
  SELECT
    pp.vendor,
    COUNT(*) AS product_count
  FROM pending_products pp
  WHERE
    (NOT check_category OR pp.category_status = 'complete')
    AND (NOT check_weight_dimension OR pp.weight_and_dimension_status = 'complete')
    AND (NOT check_seo OR pp.seo_status = 'complete')
    AND (NOT check_copyright OR pp.copyright_status = 'complete')
    AND (NOT check_faq OR pp.faq_status = 'complete')
  GROUP BY pp.vendor
  ORDER BY product_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_vendors_by_agent IS
'Get distinct vendors with product counts filtered by agent completion status.
Uses pending_products directly (no join needed) with a covering index for fast index-only scans.';

ANALYZE pending_products;
