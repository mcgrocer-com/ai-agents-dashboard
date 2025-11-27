-- Migration: Add classification fields to scraped_products table
-- Purpose: Enable UK medicine classification validation before ERPNext sync
-- Date: 2025-11-26

-- Add classification columns to scraped_products
ALTER TABLE scraped_products
  ADD COLUMN rejected BOOLEAN DEFAULT false,
  ADD COLUMN classification TEXT CHECK (classification IN ('not_medicine', 'gsl', 'pharmacy', 'pom', 'unclear')),
  ADD COLUMN classification_reason TEXT,
  ADD COLUMN classification_confidence NUMERIC(3,2) CHECK (classification_confidence >= 0 AND classification_confidence <= 1);

-- Create indexes for efficient classification queries
CREATE INDEX idx_scraped_products_rejected ON scraped_products(rejected);
CREATE INDEX idx_scraped_products_classification ON scraped_products(classification);

-- Add comment to explain the classification system
COMMENT ON COLUMN scraped_products.rejected IS 'Product rejected due to UK medicine classification (P-med, POM, or unclear)';
COMMENT ON COLUMN scraped_products.classification IS 'UK medicine classification: not_medicine (ACCEPTED), gsl (ACCEPTED), pharmacy (REJECTED), pom (REJECTED), unclear (REJECTED)';
COMMENT ON COLUMN scraped_products.classification_reason IS 'Short explanation of classification decision from AI';
COMMENT ON COLUMN scraped_products.classification_confidence IS 'AI confidence score (0.0 to 1.0) for classification decision';
