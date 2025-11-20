-- Migration: Document User Preferences Field
-- Created: 2025-11-20
-- Description: Documents the usage of the preferences JSONB field in the users table
--              for storing vendor sync preferences and other user-specific settings.
--
-- The preferences field is already defined as JSONB in the users table.
-- This migration serves as documentation for the preferences structure.
--
-- Preferences Structure:
-- {
--   "sync_vendors": string[]  // Array of vendor names to sync to ERPNext
--                             // If empty or null, all vendors are synced (default behavior)
--                             // Used by sync-completed-products-to-erpnext edge function
-- }
--
-- Example values:
-- {}                                           // Default: sync all vendors
-- {"sync_vendors": []}                         // Explicitly sync all vendors
-- {"sync_vendors": ["booker", "brakes"]}       // Only sync booker and brakes
-- {"sync_vendors": ["ocado"]}                  // Only sync ocado
--
-- Usage:
-- 1. Admin configures vendor sync preferences via Scraper Agent page UI
-- 2. Preferences saved to users.preferences.sync_vendors for admin user
-- 3. sync-completed-products-to-erpnext edge function (cron job) queries admin user preferences directly
--    Query: SELECT preferences FROM users WHERE role = 'admin' AND is_active = true LIMIT 1
-- 4. Edge function filters pending products by selected vendors using SQL ANY() clause
--
-- UI Location: Scraper Agent page > "Configure Sync Vendors" button (visible when "All Vendors" filter selected)
--
-- Note: Cron jobs don't have user context, so the edge function queries the admin user directly
--       instead of extracting user ID from JWT token

-- Add comment to preferences column for documentation
COMMENT ON COLUMN users.preferences IS 'JSONB field storing user-specific preferences. Structure: {"sync_vendors": string[] | null} where sync_vendors contains vendor names to sync to ERPNext. Empty/null means sync all vendors.';

-- Verify column exists (no-op query for migration validation)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'preferences';
