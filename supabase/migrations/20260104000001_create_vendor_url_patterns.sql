-- Create vendor_url_patterns table for self-learning URL pattern detection
-- This table stores learned URL patterns for unknown domains

CREATE TABLE IF NOT EXISTS vendor_url_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,

  -- URL patterns (stored as JSON arrays of regex strings)
  product_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Learning metadata
  learning_status TEXT NOT NULL DEFAULT 'pending' CHECK (learning_status IN ('pending', 'learned', 'failed')),
  example_product_urls JSONB DEFAULT '[]'::jsonb,
  example_category_urls JSONB DEFAULT '[]'::jsonb,

  -- Confidence and verification
  confidence_score DECIMAL(3,2) DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  sample_size INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  learned_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,

  -- Notes from research agent
  research_notes TEXT,

  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- Index for fast domain lookup
CREATE INDEX IF NOT EXISTS idx_vendor_url_patterns_domain ON vendor_url_patterns(domain);

-- Index for learning status filtering
CREATE INDEX IF NOT EXISTS idx_vendor_url_patterns_status ON vendor_url_patterns(learning_status);

-- Index for last_used tracking
CREATE INDEX IF NOT EXISTS idx_vendor_url_patterns_last_used ON vendor_url_patterns(last_used_at DESC);

-- Comments
COMMENT ON TABLE vendor_url_patterns IS 'Self-learning URL pattern detection for unknown vendor domains';
COMMENT ON COLUMN vendor_url_patterns.product_patterns IS 'Array of regex patterns that match product page URLs';
COMMENT ON COLUMN vendor_url_patterns.category_patterns IS 'Array of regex patterns that match category/listing page URLs';
COMMENT ON COLUMN vendor_url_patterns.learning_status IS 'pending: queued for research, learned: patterns extracted, failed: research failed';
COMMENT ON COLUMN vendor_url_patterns.confidence_score IS 'AI confidence in pattern accuracy (0.0 to 1.0)';
COMMENT ON COLUMN vendor_url_patterns.sample_size IS 'Number of URLs analyzed during pattern learning';
