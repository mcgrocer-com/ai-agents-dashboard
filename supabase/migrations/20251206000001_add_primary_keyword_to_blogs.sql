-- ============================================================================
-- Migration: Add primary_keyword text column to blogger_blogs
-- Description: Stores the primary keyword as a text string directly on the blog
--              instead of using the foreign key relationship to blogger_keywords
-- Date: 2025-12-06
-- ============================================================================

-- Add primary_keyword column to store the keyword string directly
ALTER TABLE blogger_blogs
ADD COLUMN primary_keyword TEXT;

-- Add comment for documentation
COMMENT ON COLUMN blogger_blogs.primary_keyword IS 'Primary keyword for SEO optimization, stored as text string';

-- Create index for searching by keyword
CREATE INDEX idx_blogger_blogs_primary_keyword ON blogger_blogs(primary_keyword);
