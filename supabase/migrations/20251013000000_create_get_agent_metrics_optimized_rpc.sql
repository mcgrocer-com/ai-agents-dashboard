-- Create optimized RPC function for agent metrics aggregation
-- Uses server-side SQL aggregation instead of fetching all rows for client-side filtering
-- Reduces data transfer from ~40K rows to a single aggregated row per agent

CREATE OR REPLACE FUNCTION get_agent_metrics_optimized(
  agent_type TEXT
)
RETURNS TABLE (
  total_products BIGINT,
  pending_count BIGINT,
  processing_count BIGINT,
  complete_count BIGINT,
  failed_count BIGINT,
  avg_confidence NUMERIC,
  total_cost NUMERIC,
  last_run TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  status_col TEXT;
  cost_col TEXT;
  confidence_col TEXT;
BEGIN
  -- Map agent type to column names
  CASE agent_type
    WHEN 'category' THEN
      status_col := 'category_status';
      cost_col := 'category_cost';
      confidence_col := 'category_confidence';
    WHEN 'weight_dimension' THEN
      status_col := 'weight_and_dimension_status';
      cost_col := 'weight_cost';
      confidence_col := 'dimension_confidence';
    WHEN 'seo' THEN
      status_col := 'seo_status';
      cost_col := 'seo_cost';
      confidence_col := 'seo_confidence';
    ELSE
      RAISE EXCEPTION 'Invalid agent_type: %', agent_type;
  END CASE;

  -- Return aggregated metrics using conditional aggregation
  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(*)::BIGINT as total_products,
      COUNT(*) FILTER (WHERE %I = ''pending'')::BIGINT as pending_count,
      COUNT(*) FILTER (WHERE %I = ''processing'')::BIGINT as processing_count,
      COUNT(*) FILTER (WHERE %I = ''complete'')::BIGINT as complete_count,
      COUNT(*) FILTER (WHERE %I = ''failed'')::BIGINT as failed_count,
      ROUND(AVG(%I) FILTER (WHERE %I IS NOT NULL), 2) as avg_confidence,
      COALESCE(SUM(%I), 0) as total_cost,
      MAX(updated_at) FILTER (WHERE %I != ''pending'') as last_run
    FROM pending_products
  ',
    status_col, status_col, status_col, status_col,
    confidence_col, confidence_col,
    cost_col,
    status_col
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agent_metrics_optimized(TEXT) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION get_agent_metrics_optimized IS
  'Efficiently aggregates agent metrics using server-side SQL.
  Reduces data transfer from ~40K rows to a single aggregated row.
  Used by LiveAgentStatusCard for real-time metrics updates.';
