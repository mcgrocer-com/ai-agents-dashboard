-- Create RPC function for agent-specific vendor statistics
-- Returns statistics for a specific agent type filtered by vendor
-- Supports 'all' vendors for aggregated statistics

CREATE OR REPLACE FUNCTION get_agent_vendor_statistics(
  agent_type TEXT,
  vendor_filter TEXT
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  status_col TEXT;
BEGIN
  -- Map agent type to status column name
  CASE agent_type
    WHEN 'category' THEN
      status_col := 'category_status';
    WHEN 'weight_dimension' THEN
      status_col := 'weight_and_dimension_status';
    WHEN 'seo' THEN
      status_col := 'seo_status';
    ELSE
      RAISE EXCEPTION 'Invalid agent_type: %. Must be category, weight_dimension, or seo', agent_type;
  END CASE;

  -- Aggregate statistics with vendor filtering
  EXECUTE format('
    SELECT json_build_object(
      ''totalProducts'', COUNT(*)::INTEGER,
      ''pending'', COUNT(*) FILTER (WHERE %I = ''pending'')::INTEGER,
      ''processing'', COUNT(*) FILTER (WHERE %I = ''processing'')::INTEGER,
      ''complete'', COUNT(*) FILTER (WHERE %I = ''complete'')::INTEGER,
      ''failed'', COUNT(*) FILTER (WHERE %I = ''failed'')::INTEGER
    )
    FROM pending_products pp
    INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
    WHERE $1 IS NULL OR $1 = ''all'' OR sp.vendor = $1
  ', status_col, status_col, status_col, status_col)
  INTO result
  USING vendor_filter;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_agent_vendor_statistics(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_vendor_statistics(TEXT, TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION get_agent_vendor_statistics IS
  'Returns agent-specific statistics filtered by vendor.
  Supports vendor_filter = ''all'' for aggregated statistics across all vendors.
  Used by AgentVendorStatistics component on agent monitoring pages.';

-- Example usage:
-- SELECT get_agent_vendor_statistics('category', 'all');
-- SELECT get_agent_vendor_statistics('category', 'argos');
-- SELECT get_agent_vendor_statistics('weight_dimension', 'superdrug');
-- SELECT get_agent_vendor_statistics('seo', 'boots');
