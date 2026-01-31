-- Add FAQ agent to get_agent_metrics_optimized() function
-- The parameterless version returns metrics for all agents using UNION ALL

CREATE OR REPLACE FUNCTION get_agent_metrics_optimized()
RETURNS TABLE (
  agent_type TEXT,
  total_products BIGINT,
  pending_count BIGINT,
  processing_count BIGINT,
  complete_count BIGINT,
  failed_count BIGINT,
  avg_confidence NUMERIC,
  total_cost NUMERIC,
  last_run TIMESTAMPTZ
)
LANGUAGE SQL
AS $$
  -- Category Agent
  SELECT
    'category'::TEXT as agent_type,
    COUNT(*)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE category_status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE category_status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE category_status = 'complete')::BIGINT as complete_count,
    COUNT(*) FILTER (WHERE category_status = 'failed')::BIGINT as failed_count,
    ROUND(AVG(category_confidence) FILTER (WHERE category_confidence IS NOT NULL), 2) as avg_confidence,
    COALESCE(SUM(category_cost), 0) as total_cost,
    MAX(updated_at) FILTER (WHERE category_status != 'pending') as last_run
  FROM pending_products

  UNION ALL

  -- Weight & Dimension Agent
  SELECT
    'weight_dimension'::TEXT as agent_type,
    COUNT(*)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE weight_and_dimension_status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE weight_and_dimension_status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE weight_and_dimension_status = 'complete')::BIGINT as complete_count,
    COUNT(*) FILTER (WHERE weight_and_dimension_status = 'failed')::BIGINT as failed_count,
    ROUND(AVG(dimension_confidence) FILTER (WHERE dimension_confidence IS NOT NULL), 2) as avg_confidence,
    COALESCE(SUM(weight_cost), 0) as total_cost,
    MAX(updated_at) FILTER (WHERE weight_and_dimension_status != 'pending') as last_run
  FROM pending_products

  UNION ALL

  -- SEO Agent
  SELECT
    'seo'::TEXT as agent_type,
    COUNT(*)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE seo_status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE seo_status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE seo_status = 'complete')::BIGINT as complete_count,
    COUNT(*) FILTER (WHERE seo_status = 'failed')::BIGINT as failed_count,
    ROUND(AVG(seo_confidence) FILTER (WHERE seo_confidence IS NOT NULL), 2) as avg_confidence,
    COALESCE(SUM(seo_cost), 0) as total_cost,
    MAX(updated_at) FILTER (WHERE seo_status != 'pending') as last_run
  FROM pending_products

  UNION ALL

  -- Copyright Agent
  SELECT
    'copyright'::TEXT as agent_type,
    COUNT(*) FILTER (WHERE copyright_status IS NOT NULL)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE copyright_status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE copyright_status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE copyright_status = 'complete')::BIGINT as complete_count,
    COUNT(*) FILTER (WHERE copyright_status = 'failed')::BIGINT as failed_count,
    ROUND(AVG(copyright_confidence) FILTER (WHERE copyright_confidence IS NOT NULL), 2) as avg_confidence,
    COALESCE(SUM(copyright_cost), 0) as total_cost,
    MAX(updated_at) FILTER (WHERE copyright_status IS NOT NULL AND copyright_status != 'pending') as last_run
  FROM pending_products

  UNION ALL

  -- FAQ Agent
  SELECT
    'faq'::TEXT as agent_type,
    COUNT(*) FILTER (WHERE faq_status IS NOT NULL)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE faq_status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE faq_status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE faq_status = 'complete')::BIGINT as complete_count,
    COUNT(*) FILTER (WHERE faq_status = 'failed')::BIGINT as failed_count,
    ROUND(AVG(faq_confidence) FILTER (WHERE faq_confidence IS NOT NULL), 2) as avg_confidence,
    COALESCE(SUM(faq_cost), 0) as total_cost,
    MAX(updated_at) FILTER (WHERE faq_status IS NOT NULL AND faq_status != 'pending') as last_run
  FROM pending_products;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_agent_metrics_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_metrics_optimized() TO anon;

-- Update comment
COMMENT ON FUNCTION get_agent_metrics_optimized() IS
  'Returns aggregated metrics for all agents (category, weight_dimension, seo, copyright, faq).
  Uses efficient server-side aggregation with UNION ALL.
  Used by dashboard for displaying agent status cards.';
