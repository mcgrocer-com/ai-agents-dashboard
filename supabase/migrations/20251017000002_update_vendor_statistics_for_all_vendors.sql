-- Update get_vendor_statistics function to support aggregating all vendors
-- When vendor_name is NULL or 'all', returns statistics across all vendors

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
    END)::INTEGER
  )
  INTO result
  FROM pending_products pp
  INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
  WHERE vendor_name IS NULL OR vendor_name = 'all' OR sp.vendor = vendor_name;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO anon;

-- Example usage:
-- SELECT get_vendor_statistics('all');  -- Returns statistics for all vendors
-- SELECT get_vendor_statistics('argos'); -- Returns statistics for specific vendor
