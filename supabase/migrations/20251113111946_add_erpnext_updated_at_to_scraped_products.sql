-- Add erpnext_updated_at column to scraped_products for efficient sorting
-- This denormalizes data from pending_products to enable sorting without joins

-- 1. Add the column
ALTER TABLE scraped_products
ADD COLUMN IF NOT EXISTS erpnext_updated_at TIMESTAMPTZ;

-- 2. Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_scraped_products_erpnext_updated_at
ON scraped_products(erpnext_updated_at DESC NULLS LAST);

-- 3. Sync existing data from pending_products
UPDATE scraped_products sp
SET erpnext_updated_at = pp.erpnext_updated_at
FROM pending_products pp
WHERE sp.id = pp.scraped_product_id
  AND pp.erpnext_updated_at IS NOT NULL;

-- 4. Create trigger function to keep erpnext_updated_at in sync
CREATE OR REPLACE FUNCTION sync_erpnext_updated_at_to_scraped_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Update scraped_products when pending_products.erpnext_updated_at changes
  IF (TG_OP = 'UPDATE' AND NEW.erpnext_updated_at IS DISTINCT FROM OLD.erpnext_updated_at)
     OR (TG_OP = 'INSERT' AND NEW.erpnext_updated_at IS NOT NULL) THEN

    UPDATE scraped_products
    SET erpnext_updated_at = NEW.erpnext_updated_at
    WHERE id = NEW.scraped_product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on pending_products
DROP TRIGGER IF EXISTS sync_erpnext_updated_at_trigger ON pending_products;
CREATE TRIGGER sync_erpnext_updated_at_trigger
AFTER INSERT OR UPDATE ON pending_products
FOR EACH ROW
WHEN (NEW.scraped_product_id IS NOT NULL)
EXECUTE FUNCTION sync_erpnext_updated_at_to_scraped_products();

-- Add comment explaining the denormalization
COMMENT ON COLUMN scraped_products.erpnext_updated_at IS
'Denormalized from pending_products.erpnext_updated_at for efficient sorting.
Automatically synced via trigger when pending_products is updated.';
