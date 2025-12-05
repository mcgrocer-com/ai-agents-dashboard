-- Migration: Create scraped_articles_cache table
-- Purpose: Cache scraped article content with TTL to speed up repeated scraping

-- Create the cache table
CREATE TABLE IF NOT EXISTS scraped_articles_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL, -- MD5 hash for faster lookups
  title TEXT,
  text TEXT,
  headings TEXT[], -- Array of section headings
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  html_size INTEGER DEFAULT 0, -- Original HTML size in bytes
  scrape_duration_ms INTEGER, -- Time taken to scrape
  extract_duration_ms INTEGER, -- Time taken for LLM extraction
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- TTL expiration timestamp
  hit_count INTEGER DEFAULT 0, -- Number of cache hits
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on url_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_scraped_articles_cache_url_hash ON scraped_articles_cache(url_hash);

-- Create index on expires_at for TTL cleanup queries
CREATE INDEX IF NOT EXISTS idx_scraped_articles_cache_expires_at ON scraped_articles_cache(expires_at);

-- Create index on created_at for recent cache entries
CREATE INDEX IF NOT EXISTS idx_scraped_articles_cache_created_at ON scraped_articles_cache(created_at DESC);

-- Enable Row Level Security
ALTER TABLE scraped_articles_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (cache is shared across users)
CREATE POLICY "Allow all operations on cache" ON scraped_articles_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM scraped_articles_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get cache stats
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE(
  total_entries BIGINT,
  expired_entries BIGINT,
  total_size_mb NUMERIC,
  avg_word_count NUMERIC,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_entries,
    COUNT(*) FILTER (WHERE expires_at < NOW())::BIGINT as expired_entries,
    ROUND(SUM(LENGTH(text))::NUMERIC / 1024 / 1024, 2) as total_size_mb,
    ROUND(AVG(word_count)::NUMERIC, 0) as avg_word_count,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry
  FROM scraped_articles_cache;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE scraped_articles_cache IS 'Cache for scraped article content with TTL support. Used by Decodo + LLM extraction pipeline.';
COMMENT ON COLUMN scraped_articles_cache.url_hash IS 'MD5 hash of URL for faster index lookups';
COMMENT ON COLUMN scraped_articles_cache.expires_at IS 'Cache entry expiration timestamp. Default TTL is 7 days.';
COMMENT ON COLUMN scraped_articles_cache.hit_count IS 'Number of times this cache entry was retrieved';
