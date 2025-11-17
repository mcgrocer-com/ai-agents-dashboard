-- Restructure seo_keywords table to match correct format
-- Old structure: Each keyword was a separate row
-- New structure: Each product has multiple keyword columns

-- Step 1: Backup existing data (if needed for reference)
CREATE TABLE IF NOT EXISTS seo_keywords_backup AS SELECT * FROM seo_keywords;

-- Step 2: Drop the old table
DROP TABLE IF EXISTS seo_keywords CASCADE;

-- Step 3: Create new seo_keywords table with correct structure
CREATE TABLE seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_title TEXT NOT NULL,
  main_keyword TEXT,
  kw1 TEXT,
  kw2 TEXT,
  kw3 TEXT,
  kw4 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create index for faster lookups
CREATE INDEX idx_seo_keywords_product_title ON seo_keywords(product_title);
CREATE INDEX idx_seo_keywords_main_keyword ON seo_keywords(main_keyword);

-- Step 5: Add comment to table
COMMENT ON TABLE seo_keywords IS 'SEO keywords for products with multiple keyword columns per product';
COMMENT ON COLUMN seo_keywords.product_title IS 'Product title (used as category/identifier)';
COMMENT ON COLUMN seo_keywords.main_keyword IS 'Primary keyword for the product';
COMMENT ON COLUMN seo_keywords.kw1 IS 'Keyword 1';
COMMENT ON COLUMN seo_keywords.kw2 IS 'Keyword 2';
COMMENT ON COLUMN seo_keywords.kw3 IS 'Keyword 3';
COMMENT ON COLUMN seo_keywords.kw4 IS 'Keyword 4';
