-- Remove the auto-update trigger for updated_at on pending_products
-- This trigger was causing all updates to refresh updated_at, making it impossible
-- to distinguish between real agent processing updates and administrative updates.
--
-- The updated_at field should only be updated when:
-- 1. Agent status changes (category_status, weight_and_dimension_status, seo_status)
-- 2. Agent completes processing and adds data
--
-- It should NOT update on:
-- - Validation resets (sync function cleaning invalid data)
-- - Manual administrative updates
-- - ERPNext sync metadata updates

DROP TRIGGER IF EXISTS update_pending_products_updated_at ON pending_products;

-- We'll keep the function in case other tables need it
-- But we won't auto-trigger it on pending_products anymore
COMMENT ON FUNCTION update_updated_at_column IS
'Updates updated_at to current timestamp. Available for manual use but no longer auto-triggered on pending_products.';
