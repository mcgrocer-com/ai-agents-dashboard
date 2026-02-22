-- Merge duplicate vendor names into their canonical forms
--
-- "john lewis" (8,627 pending) → "johnlewis"
-- "sainsbury" (29,950 scraped + 21,267 pending) → "sainsburys"
-- "holland & barrett" (1,247 pending) → "holland&barret"

-- 1. john lewis → johnlewis (only exists in pending_products)
UPDATE pending_products SET vendor = 'johnlewis' WHERE vendor = 'john lewis';

-- 2. sainsbury → sainsburys (exists in both tables)
UPDATE scraped_products SET vendor = 'sainsburys' WHERE vendor = 'sainsbury';
UPDATE pending_products SET vendor = 'sainsburys' WHERE vendor = 'sainsbury';

-- 3. holland & barrett → holland&barret (only exists in pending_products)
UPDATE pending_products SET vendor = 'holland&barret' WHERE vendor = 'holland & barrett';

-- 4. Fix get_vendor_statistics: remove unnecessary INNER JOIN to scraped_products
-- All aggregation columns live on pending_products; the join was only for vendor filtering
-- but pending_products has its own vendor column. Eliminates full 224k-row join scan.
DROP FUNCTION IF EXISTS get_vendor_statistics(text);

CREATE OR REPLACE FUNCTION get_vendor_statistics(vendor_name TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalProducts', COUNT(*)::INTEGER,
    'withCategoryAndWeight', COUNT(CASE
      WHEN category_status = 'complete' AND weight_and_dimension_status = 'complete'
      THEN 1
    END)::INTEGER,
    'withAllData', COUNT(CASE
      WHEN category_status = 'complete'
        AND weight_and_dimension_status = 'complete'
        AND seo_status = 'complete'
      THEN 1
    END)::INTEGER,
    'syncedToErpNext', COUNT(CASE
      WHEN erpnext_updated_at IS NOT NULL
        AND (failed_sync_at IS NULL OR failed_sync_at < erpnext_updated_at)
      THEN 1
    END)::INTEGER,
    'failedToSync', COUNT(CASE
      WHEN failed_sync_at IS NOT NULL
        AND (erpnext_updated_at IS NULL OR failed_sync_at > erpnext_updated_at)
      THEN 1
    END)::INTEGER,
    'syncedToday', COUNT(CASE
      WHEN erpnext_updated_at >= CURRENT_DATE
        AND (failed_sync_at IS NULL OR failed_sync_at < erpnext_updated_at)
      THEN 1
    END)::INTEGER,
    'syncedYesterday', COUNT(CASE
      WHEN erpnext_updated_at >= CURRENT_DATE - INTERVAL '1 day'
        AND erpnext_updated_at < CURRENT_DATE
        AND (failed_sync_at IS NULL OR failed_sync_at < erpnext_updated_at)
      THEN 1
    END)::INTEGER,
    'syncedThisWeek', COUNT(CASE
      WHEN erpnext_updated_at >= DATE_TRUNC('week', CURRENT_DATE)
        AND (failed_sync_at IS NULL OR failed_sync_at < erpnext_updated_at)
      THEN 1
    END)::INTEGER
  )
  INTO result
  FROM pending_products pp
  WHERE vendor_name IS NULL OR vendor_name = 'all' OR pp.vendor = vendor_name;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO anon;
