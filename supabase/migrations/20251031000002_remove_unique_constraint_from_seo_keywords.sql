-- Remove the unique constraint on seo_keywords.keyword
-- We need to allow duplicate keywords for different categories
-- Uniqueness should be based on keyword + category combination, not just keyword

DROP INDEX IF EXISTS seo_keywords_keyword_lower_unique;

-- Note: Duplicate checking is now handled at the application level
-- by comparing both keyword AND category fields together
