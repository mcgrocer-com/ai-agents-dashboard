# resync-vendor-to-erpnext

## Overview

Batch edge function that resets ERPNext sync status for all products from a specific vendor, forcing them to be re-synced in the next automatic sync cycle. This function clears the `erpnext_updated_at`, `failed_sync_at`, and `failed_sync_error_message` fields for all products matching the vendor, making them eligible for the scheduled sync job.

Useful for bulk retrying failed syncs or forcing vendor-wide re-sync after data corrections.

## Endpoint

- **URL**: `/resync-vendor-to-erpnext`
- **Method**: `POST`
- **Authentication**: Supabase Anon/Service Key via Bearer token
- **CORS**: Enabled for cross-origin requests

## Request

### Headers
- `Content-Type`: `application/json` (required)
- `Authorization`: `Bearer YOUR_SUPABASE_KEY` (required)

### Body
```json
{
  "vendor": "FreshFarm"
}
```

**Required Fields:**
- `vendor`: String from `pending_products.vendor` (exact match, case-sensitive)

## Response

### Success Response
**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Successfully reset 45 products for vendor: FreshFarm. They will be re-synced to ERPNext in the next sync cycle.",
  "stats": {
    "total_products": 45,
    "successfully_reset": 45,
    "failed": 0
  },
  "details": {
    "vendor": "FreshFarm"
  }
}
```

**Response Fields:**
- `success`: `true` on successful reset
- `message`: Human-readable success message
- `stats`: Reset statistics
  - `total_products`: Total products found for vendor
  - `successfully_reset`: Number of products successfully reset
  - `failed`: Number of products that failed to reset
- `details`: Request details
  - `vendor`: Vendor name that was reset

### No Products Found Response
**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "No products found for vendor: NonExistentVendor",
  "stats": {
    "total_products": 0,
    "successfully_reset": 0,
    "failed": 0
  }
}
```

### Validation Error Response
**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "error": "Missing required field: vendor",
  "usage": {
    "endpoint": "POST /resync-vendor-to-erpnext",
    "body": { "vendor": "string (required)" }
  }
}
```

### Error Response
**Status Code**: `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Failed to reset sync status",
  "details": "Error message details"
}
```

## Environment Variables

### Required
- `SUPABASE_URL`: Supabase project URL (automatically provided)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access (automatically provided)

## Database Tables

### Primary Tables
- **pending_products**: Product sync status tracking
  - Modified columns:
    - `erpnext_updated_at`: Set to NULL (removes successful sync timestamp)
    - `failed_sync_at`: Set to NULL (clears failed sync timestamp)
    - `failed_sync_error_message`: Set to NULL (clears error message)
  - Filter: `vendor = {requested_vendor}`

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Parse Request Body                                        │
│    - Extract vendor name                                     │
│    - Validate vendor is provided                            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Count Products for Vendor                                 │
│    - Query pending_products WHERE vendor = {vendor}         │
│    - Get total count                                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check if Vendor Has Products                             │
│    - If count = 0, return success with empty stats         │
│    - If count > 0, proceed to reset                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Reset Sync Status for All Vendor Products               │
│    - UPDATE pending_products                                │
│    - SET erpnext_updated_at = NULL                          │
│    - SET failed_sync_at = NULL                              │
│    - SET failed_sync_error_message = NULL                   │
│    - WHERE vendor = {vendor}                                │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Calculate Statistics                                      │
│    - total_products: Count from step 2                      │
│    - successfully_reset: Number of rows updated             │
│    - failed: total_products - successfully_reset            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Success Response with Stats                       │
│    - Include reset statistics and vendor details            │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Bulk Vendor Reset
Resets all products for a specific vendor in a single database operation.

### 2. Comprehensive Status Clear
Clears three related fields for all vendor products:
- `erpnext_updated_at`: Removes successful sync timestamp
- `failed_sync_at`: Removes failed sync timestamp
- `failed_sync_error_message`: Clears error message

### 3. Statistics Reporting
Returns detailed statistics about the reset operation:
- Total products found for vendor
- Successfully reset count
- Failed count (if any discrepancy)

### 4. Non-Destructive
Does not modify product data (category, weight, SEO, etc.), only sync status fields.

### 5. Automatic Retry
After reset, all vendor products will be picked up by the scheduled `sync-completed-products-to-erpnext` function in the next cycle (every 15 minutes).

## Example Usage

### Reset Single Vendor
```bash
curl -X POST https://your-project.supabase.co/functions/v1/resync-vendor-to-erpnext \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "FreshFarm"
  }'
```

### Reset from Frontend (TypeScript)
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resyncVendor(vendor: string) {
  const { data, error } = await supabase.functions.invoke('resync-vendor-to-erpnext', {
    body: { vendor }
  });

  if (error) {
    console.error('Vendor resync failed:', error);
    return null;
  }

  console.log(data.message);
  console.log(`Reset ${data.stats.successfully_reset} products`);

  return data;
}

// Usage
const result = await resyncVendor('FreshFarm');
if (result) {
  console.log(`All ${result.stats.total_products} products will be re-synced in the next cycle`);
}
```

### Reset Multiple Vendors
```typescript
async function resyncMultipleVendors(vendors: string[]) {
  const results = await Promise.all(
    vendors.map(vendor =>
      supabase.functions.invoke('resync-vendor-to-erpnext', {
        body: { vendor }
      })
    )
  );

  const totalReset = results.reduce((sum, r) =>
    sum + (r.data?.stats.successfully_reset || 0), 0
  );

  console.log(`Reset ${totalReset} products across ${vendors.length} vendors`);

  return results;
}

// Usage
await resyncMultipleVendors(['FreshFarm', 'OrganicStore', 'HealthMarket']);
```

## Use Cases

### 1. Retry Failed Vendor Syncs
When multiple products from a vendor fail to sync:

```typescript
// Check for vendors with failed products
const { data: failedProducts } = await supabase
  .from('pending_products')
  .select('vendor')
  .not('failed_sync_error_message', 'is', null);

// Get unique vendors
const vendors = [...new Set(failedProducts.map(p => p.vendor))];

// Reset all vendors with failures
for (const vendor of vendors) {
  await resyncVendor(vendor);
}
```

### 2. Force Re-sync After Vendor Data Update
After updating data for all products from a vendor:

```typescript
// 1. Update all products from vendor
await supabase
  .from('pending_products')
  .update({ category: 'Updated Category' })
  .eq('vendor', 'FreshFarm');

// 2. Force re-sync entire vendor
await resyncVendor('FreshFarm');
```

### 3. Re-sync After Vendor Configuration Change
After changing vendor-specific settings or mappings:

```typescript
// Reset vendor to push latest configuration
const result = await resyncVendor('FreshFarm');

console.log(`Queued ${result.stats.total_products} products for re-sync`);
```

### 4. Scheduled Vendor Maintenance
Regular weekly re-sync of specific vendors:

```typescript
// Weekly maintenance: force re-sync of priority vendors
const priorityVendors = ['FreshFarm', 'OrganicStore'];

for (const vendor of priorityVendors) {
  const result = await resyncVendor(vendor);
  console.log(`${vendor}: Reset ${result.stats.successfully_reset} products`);
}
```

## Logging

The function logs with emoji prefixes for easy identification:

- `🔄 Resync to ERPNext request: { vendor: "FreshFarm" }`
- `✅ Found {count} products for vendor: FreshFarm`
- `⚠️ No products found for vendor: NonExistentVendor`
- `❌ Error resetting sync status: {error}`
- `🎉 Resync complete: {stats}`
- `💥 Unexpected error: {error}`

## Verification

### Check if Reset Was Successful
```sql
-- Verify sync status was cleared for all vendor products
SELECT
  id,
  url,
  vendor,
  erpnext_updated_at,
  failed_sync_at,
  failed_sync_error_message
FROM pending_products
WHERE vendor = 'FreshFarm';

-- All three status fields should be NULL after reset
```

### Monitor Re-sync Progress
```sql
-- Check how many vendor products are queued for sync
SELECT
  COUNT(*) as queued_count
FROM pending_products
WHERE vendor = 'FreshFarm'
  AND category_status = 'complete'
  AND weight_and_dimension_status = 'complete'
  AND seo_status = 'complete'
  AND erpnext_updated_at IS NULL;

-- Check re-sync completion over time
SELECT
  COUNT(*) as synced_count
FROM pending_products
WHERE vendor = 'FreshFarm'
  AND erpnext_updated_at IS NOT NULL
  AND erpnext_updated_at > NOW() - INTERVAL '1 hour';
```

### List All Vendors
```sql
-- Get list of all vendors with product counts
SELECT
  vendor,
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE erpnext_updated_at IS NULL) as needs_sync,
  COUNT(*) FILTER (WHERE failed_sync_error_message IS NOT NULL) as has_errors
FROM pending_products
GROUP BY vendor
ORDER BY total_products DESC;
```

## Performance Notes

- **Operation**: Bulk UPDATE query (O(n) where n = vendor product count)
- **Response Time**: Varies by vendor size
  - Small vendors (< 100 products): < 500ms
  - Medium vendors (100-1000 products): 500ms - 2s
  - Large vendors (> 1000 products): 2s - 5s
- **Rate Limiting**: None (can be called multiple times)
- **Idempotent**: Safe to call multiple times on same vendor
- **Database Load**: Single UPDATE statement per call

## Comparison with Related Functions

| Feature | resync-vendor-to-erpnext | resync-product-to-erpnext | push-products-to-erpnext |
|---------|--------------------------|---------------------------|--------------------------|
| Scope | All products from vendor | Single product | Multiple products |
| Action | Reset sync status | Reset sync status | Immediate push |
| Timing | Next scheduled sync | Next scheduled sync | Immediate |
| Input | vendor (string) | productId (UUID) | productUrls (array) |
| Batch Size | Entire vendor | 1 product | Configurable |

## Security Considerations

- **Authentication Required**: Must provide valid Supabase key
- **CORS Enabled**: Can be called from browser clients
- **Service Role Access**: Uses service role for database access (bypasses RLS)
- **Input Validation**: Validates vendor is provided and non-empty
- **SQL Injection Protection**: Uses Supabase client with parameterized queries
- **Case Sensitivity**: Vendor name is case-sensitive (exact match required)

## Troubleshooting

### No Products Found (0 count)
**Cause**: Vendor name doesn't match any products or is misspelled

**Solution**:
```sql
-- List all vendors with exact names
SELECT DISTINCT vendor FROM pending_products ORDER BY vendor;

-- Check for similar vendor names (fuzzy match)
SELECT DISTINCT vendor FROM pending_products
WHERE vendor ILIKE '%fresh%';

-- Vendor names are case-sensitive
-- 'FreshFarm' != 'freshfarm' != 'FRESHFARM'
```

### Statistics Discrepancy (failed > 0)
**Cause**: Some products failed to update due to database constraints or errors

**Solution**:
```sql
-- Check for database errors
SELECT id, url, vendor FROM pending_products
WHERE vendor = 'FreshFarm'
  AND erpnext_updated_at IS NOT NULL;  -- These should be NULL after reset

-- Retry the reset operation
-- Or use resync-product-to-erpnext for individual products
```

### Reset Successful but Products Not Re-syncing
**Cause**: Products don't meet sync criteria

**Solution**:
```sql
-- Check agent completion status for vendor products
SELECT
  COUNT(*) FILTER (WHERE category_status != 'complete') as missing_category,
  COUNT(*) FILTER (WHERE weight_and_dimension_status != 'complete') as missing_weight,
  COUNT(*) FILTER (WHERE seo_status != 'complete') as missing_seo,
  COUNT(*) FILTER (WHERE scraped_product_id IS NULL) as missing_reference,
  COUNT(*) FILTER (WHERE price IS NULL OR price <= 0) as invalid_price
FROM pending_products
WHERE vendor = 'FreshFarm';

-- Products must have:
-- - All agent statuses = 'complete'
-- - Valid scraped_product_id reference
-- - Valid price > 0
```

### Function Returns Error 500
**Cause**: Database connection or permission issues

**Solution**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
2. Check function deployment status
3. Review function logs for detailed errors:
   ```bash
   supabase functions logs resync-vendor-to-erpnext
   ```

## Related Functions

- **sync-completed-products-to-erpnext**: Scheduled automatic sync (picks up reset products)
- **resync-product-to-erpnext**: Reset single product
- **push-products-to-erpnext**: Manual immediate push (bypasses sync cycle)

## Additional Resources

- [Scheduled Sync Function](../sync-completed-products-to-erpnext/README.md)
- [Single Product Resync Function](../resync-product-to-erpnext/README.md)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
