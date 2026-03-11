-- Add URL to search fields across all RPC functions and enable searching by product URL
-- Previously only product_id, name, description, and ai_title were searchable

-- 1. Update get_products_with_validation_errors
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
         sp.url ILIKE '%' || p_search || '%' OR
         pp.ai_title ILIKE '%' || p_search || '%'
       )))
      AND (p_vendor IS NULL OR sp.vendor = p_vendor);
  END IF;

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
         sp.url ILIKE '%' || p_search || '%' OR
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

-- 2. Update get_products_sorted_by_erpnext_sync
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
       (is_uuid_search AND sp.id::TEXT = p_search) OR
       (NOT is_uuid_search AND (
         sp.product_id ILIKE '%' || p_search || '%' OR
         sp.name ILIKE '%' || p_search || '%' OR
         sp.description ILIKE '%' || p_search || '%' OR
         sp.ai_title ILIKE '%' || p_search || '%' OR
         sp.url ILIKE '%' || p_search || '%' OR
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

-- 3. Update get_products_sorted_by_failed_sync
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
         sp.url ILIKE '%' || p_search || '%' OR
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
