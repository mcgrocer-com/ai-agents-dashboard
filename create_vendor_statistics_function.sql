-- Create PostgreSQL function for efficient vendor statistics calculation
-- This function should be run in Supabase SQL Editor for optimal performance

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
  FROM pending_products
  WHERE vendor = vendor_name;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_statistics(TEXT) TO anon;

-- Example usage:
-- SELECT get_vendor_statistics('argos');
