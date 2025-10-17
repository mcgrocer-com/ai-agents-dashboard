-- Add feedback fields to pending_products table
-- These fields allow users to provide feedback/guidance when retrying agent processing

-- Add feedback columns for each agent
ALTER TABLE pending_products
ADD COLUMN IF NOT EXISTS category_feedback TEXT,
ADD COLUMN IF NOT EXISTS weight_dimension_feedback TEXT,
ADD COLUMN IF NOT EXISTS seo_feedback TEXT;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN pending_products.category_feedback IS 'Optional feedback/guidance for category agent retry attempts';
COMMENT ON COLUMN pending_products.weight_dimension_feedback IS 'Optional feedback/guidance for weight-dimension agent retry attempts';
COMMENT ON COLUMN pending_products.seo_feedback IS 'Optional feedback/guidance for SEO agent retry attempts';

-- Create or replace function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on pending_products updates
DROP TRIGGER IF EXISTS update_pending_products_updated_at ON pending_products;
CREATE TRIGGER update_pending_products_updated_at
    BEFORE UPDATE ON pending_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
